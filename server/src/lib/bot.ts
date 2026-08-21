import { Telegraf, Markup } from 'telegraf';
import { prisma } from './prisma.js';
import { adminIds, isAdminId } from './admins.js';
import { escapeMd } from './telegramText.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = (process.env.WEBAPP_URL || 'https://mishkin-twa.vercel.app').replace(/\/+$/, '');
const CHANNEL_URL = process.env.CHANNEL_URL || 'https://t.me/mishkin_candles';

if (!BOT_TOKEN) {
  console.error('CRITICAL: BOT_TOKEN is missing!');
}

// Токен-заглушка вместо падения на импорте: без неё модуль нельзя было бы
// подключить в тестах и на сборке, где бот не нужен. Запросы к Telegram с ней
// просто получают 401.
export const bot = new Telegraf(BOT_TOKEN || 'dummy_token');

// ---------------------------------------------------------------------------
// Мост «клиент ↔ менеджер»
//
// ВНИМАНИЕ: состояние диалогов живёт в памяти процесса. На Vercel каждый апдейт
// приходит в свою лямбду, поэтому связка «кто с кем говорит» там теряется между
// сообщениями — мост рассчитан на постоянный процесс (VPS, локальный запуск).
// Перенос в БД требует отдельной миграции, см. PRODUCTION_PLAN.md.
// ---------------------------------------------------------------------------

const userToAdmin = new Map<number, number>();
const adminToUser = new Map<number, number>();

interface WaitingUser {
  name: string;
  username?: string;
  requestedAt: Date;
  initialQuestion?: string;
}
/** Клиенты, нажавшие «Связь с менеджером», но ещё никем не принятые. */
const waitingUsers = new Map<number, WaitingUser>();

/** Запрос клиента на связь с менеджером: и по команде, и по кнопке. */
async function initiateSupportRequest(ctx: any) {
  const tgUser = ctx.from;
  if (!tgUser) return;
  const userId = tgUser.id;

  if (userToAdmin.has(userId)) {
    await ctx.reply(
      'Вы уже находитесь в активном диалоге с менеджером.\n' +
      'Напишите ваш вопрос прямо сюда или отправьте команду /close для завершения.',
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Завершить диалог', `close_support:${userId}`)]
        ]),
      }
    );
    return;
  }

  const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Клиент';
  waitingUsers.set(userId, {
    name,
    username: tgUser.username,
    requestedAt: new Date(),
  });

  await ctx.reply(
    `💬 *Связь с менеджером MISHKIN*\n\n` +
    `Опишите ваш вопрос или оставьте сообщение прямо в этом чате.\n\n` +
    `Мы уже уведомили команду, первый освободившийся менеджер подключится к диалогу! ✨`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отменить запрос', `cancel_support:${userId}`)],
        [Markup.button.webApp('🛍 Открыть магазин', WEBAPP_URL)]
      ]),
    }
  );

  // Имя и юзернейм задаёт сам клиент: без экранирования «Иван_Петров» ломает
  // разметку, Telegram отвечает 400 и менеджер не получает запрос вообще.
  const admins = adminIds();
  const userLink = tgUser.username ? `@${escapeMd(tgUser.username)}` : `[Профиль](tg://user?id=${userId})`;
  const alertText =
    `🆘 *Запрос помощи от клиента!*\n\n` +
    `👤 Клиент: *${escapeMd(name)}* (${userLink})\n` +
    `🆔 ID: \`${userId}\`\n\n` +
    `Нажмите кнопку ниже, чтобы подключиться к диалогу:`;

  for (const adminId of admins) {
    try {
      await bot.telegram.sendMessage(adminId, alertText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`🙋‍♂️ Принять диалог (${name})`, `take_support:${userId}`)]
        ]),
      });
    } catch (err) {
      console.error(`[support] Не удалось отправить уведомление админу ${adminId}:`, err);
    }
  }
}

/** Закрывает сессию с обеих сторон: и у клиента, и у принявшего менеджера. */
async function closeSupportSession(userId: number, adminIdOverride?: number) {
  const adminId = adminIdOverride || userToAdmin.get(userId);

  userToAdmin.delete(userId);
  if (adminId) {
    adminToUser.delete(adminId);
  }
  waitingUsers.delete(userId);

  if (adminId) {
    try {
      await bot.telegram.sendMessage(
        adminId,
        `✅ *Диалог с клиентом (ID: \`${userId}\`) завершён.*`,
        { parse_mode: 'Markdown' }
      );
    } catch {}
  }

  try {
    await bot.telegram.sendMessage(
      userId,
      `✨ *Диалог с менеджером завершён.*\n\n` +
      `Спасибо за обращение в MISHKIN! Если у вас возникнут новые вопросы, мы всегда рады помочь.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🛍 Открыть магазин', WEBAPP_URL)],
          [Markup.button.callback('💬 Связь с менеджером', 'request_support')]
        ]),
      }
    );
  } catch {}
}

// ---------------------------------------------------------------------------
// Команды
// ---------------------------------------------------------------------------

bot.start(async (ctx) => {
  const tgUser = ctx.from;
  const firstName = tgUser.first_name || 'друг';

  // Апсерт нужен для статистики: пользователь мог ни разу не открыть Mini App,
  // но /start в боте уже сделал. Ошибка записи не должна мешать ответу.
  try {
    await prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
        lastVisit: new Date(),
      },
      create: {
        telegramId: BigInt(tgUser.id),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
      }
    });
  } catch (err) {
    console.error('Failed to save user on /start:', err);
  }

  try {
    await ctx.setChatMenuButton({
      type: 'web_app',
      text: '🛍 Магазин',
      web_app: { url: WEBAPP_URL }
    });
  } catch (e) {
    console.error('Failed to set menu button', e);
  }

  // Диплинк на товар: /start product_12, /start p_12 или просто /start 12 —
  // ссылками такого вида делятся из карточки товара в приложении.
  const payload = (ctx as any).startPayload as string | undefined;
  if (payload) {
    const prodMatch = payload.match(/^(?:product_|p_|prod_)?(\d+)$/);
    if (prodMatch) {
      const prodId = parseInt(prodMatch[1], 10);
      try {
        const prod = await prisma.product.findUnique({ where: { id: prodId } });
        if (prod) {
          const priceRub = (prod.price / 100).toLocaleString('ru-RU');
          await ctx.reply(
            `✨ *${escapeMd(prod.name)}*\n\n` +
            (prod.description ? `${escapeMd(prod.description)}\n\n` : '') +
            `💰 *Цена: ${priceRub} ₽*\n\n` +
            `Нажмите кнопку ниже, чтобы открыть товар в приложении:`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.webApp(`🛍 Открыть «${prod.name}»`, `${WEBAPP_URL}/product/${prod.id}`)],
                [Markup.button.webApp('🏠 Весь каталог', `${WEBAPP_URL}/catalog`)],
                [Markup.button.callback('💬 Связь с менеджером', 'request_support')]
              ]),
            }
          );
          return;
        }
      } catch (err) {
        console.error('Failed to handle product deep link in bot:', err);
      }
    }
  }

  await ctx.reply(
    `Добро пожаловать в *MISHKIN*, ${escapeMd(firstName)}!\n\n` +
    `Мы создаём авторские изделия и уютный декор ручной работы с душой.\n\n` +
    `Нажмите кнопку ниже, чтобы открыть витрину или связаться с менеджером.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🛍 Открыть магазин', WEBAPP_URL)],
        [Markup.button.callback('💬 Связь с менеджером', 'request_support')],
        [Markup.button.url('📢 Наш канал', CHANNEL_URL)]
      ]),
    }
  );
});

bot.command(['support', 'manager'], initiateSupportRequest);

bot.action('request_support', async (ctx) => {
  await ctx.answerCbQuery();
  await initiateSupportRequest(ctx);
});

bot.action(/^cancel_support:(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1], 10);
  // Отменить может только сам заявитель: id в callback_data приходит от клиента.
  if (ctx.from.id !== userId) return;

  waitingUsers.delete(userId);
  await ctx.answerCbQuery('Запрос отменён');
  try {
    await ctx.editMessageText(
      'Запрос на связь с менеджером отменён. Нажмите кнопку ниже, чтобы открыть магазин:',
      {
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🛍 Открыть магазин', WEBAPP_URL)],
          [Markup.button.callback('💬 Связь с менеджером', 'request_support')]
        ])
      }
    );
  } catch {}
});

// Менеджер принимает диалог. callback_data содержит id клиента, поэтому кнопку
// можно переслать кому угодно — права проверяем не по факту нажатия, а по ADMIN_IDS.
bot.action(/^take_support:(\d+)$/, async (ctx) => {
  const targetUserId = parseInt(ctx.match[1], 10);
  const adminId = ctx.from.id;
  const adminName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Менеджер';

  if (!isAdminId(adminId)) {
    await ctx.answerCbQuery('⚠️ У вас нет прав администратора', { show_alert: true });
    return;
  }

  // Диалог ведёт один менеджер — иначе клиент получает два ответа на один вопрос.
  if (userToAdmin.has(targetUserId)) {
    const currentAdminId = userToAdmin.get(targetUserId);
    if (currentAdminId === adminId) {
      await ctx.answerCbQuery('Вы уже ведёте этот диалог');
    } else {
      await ctx.answerCbQuery('⚠️ Этот диалог уже принял другой менеджер', { show_alert: true });
      try {
        await ctx.editMessageText('⚠️ Этот диалог уже принял другой администратор.');
      } catch {}
    }
    return;
  }

  // Один менеджер — один клиент: иначе его ответы полетят не тому.
  if (adminToUser.has(adminId)) {
    const activeClient = adminToUser.get(adminId);
    await ctx.answerCbQuery(
      `У вас уже открыт диалог с клиентом (ID: ${activeClient}). Завершите его командой /close перед началом нового.`,
      { show_alert: true }
    );
    return;
  }

  userToAdmin.set(targetUserId, adminId);
  adminToUser.set(adminId, targetUserId);
  const waitingInfo = waitingUsers.get(targetUserId);
  waitingUsers.delete(targetUserId);

  await ctx.answerCbQuery('✅ Вы подключились к диалогу!');

  try {
    await ctx.editMessageText(
      `✅ *Вы подключились к диалогу с клиентом ${escapeMd(waitingInfo?.name || '')} (ID: \`${targetUserId}\`)*\n\n` +
      `Все ваши сообщения в этот чат будут мгновенно пересылаться клиенту.\n\n` +
      `Чтобы завершить диалог, нажмите кнопку ниже или отправьте /close.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Завершить диалог', `close_support:${targetUserId}`)]
        ]),
      }
    );
  } catch {}

  try {
    await bot.telegram.sendMessage(
      targetUserId,
      `👨‍💼 *Менеджер ${escapeMd(adminName)} подключился к диалогу!*\n\n` +
      `Напишите ваш вопрос или сообщение прямо сюда — менеджер вам ответит.\n\n` +
      `Для завершения диалога нажмите кнопку ниже или введите /close.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Завершить диалог', `close_support:${targetUserId}`)]
        ]),
      }
    );
  } catch (e) {
    console.error('Failed to notify user about support start:', e);
  }
});

bot.action(/^close_support:(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1], 10);
  const callerId = ctx.from.id;

  // Закрыть диалог вправе только его участники — id в кнопке подделывается.
  if (callerId === userId || userToAdmin.get(userId) === callerId) {
    await ctx.answerCbQuery('Диалог завершается...');
    await closeSupportSession(userId, userToAdmin.get(userId));
  } else {
    await ctx.answerCbQuery('Вы не участвуете в этом диалоге', { show_alert: true });
  }
});

// /close работает и для менеджера, и для клиента, и для неподтверждённой заявки —
// поэтому разбираем три случая по очереди.
bot.command(['close', 'stop', 'end'], async (ctx) => {
  const callerId = ctx.from.id;

  if (adminToUser.has(callerId)) {
    const targetUserId = adminToUser.get(callerId)!;
    await closeSupportSession(targetUserId, callerId);
    return;
  }

  if (userToAdmin.has(callerId)) {
    await closeSupportSession(callerId);
    return;
  }

  if (waitingUsers.has(callerId)) {
    waitingUsers.delete(callerId);
    await ctx.reply('Запрос на связь с менеджером отменён.');
    return;
  }

  await ctx.reply('У вас нет активных диалогов.');
});

bot.help((ctx) => {
  ctx.reply(
    '✨ *MISHKIN — Авторские изделия и декор ручной работы*\n\n' +
    '🛍 /start — Главное меню и витрина\n' +
    '💬 /support — Связаться с менеджером\n' +
    '❌ /close — Завершить текущий диалог',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🛍 Открыть магазин', WEBAPP_URL)],
        [Markup.button.callback('💬 Связь с менеджером', 'request_support')]
      ])
    }
  );
});

// ---------------------------------------------------------------------------
// Пересылка сообщений внутри моста
//
// Порядок проверок = приоритет роли: сначала менеджер в активном диалоге, затем
// клиент в диалоге, затем клиент, ждущий менеджера, и лишь потом «обычное»
// сообщение. Любой чужой текст экранируется — он уходит с parse_mode Markdown,
// и незакрытая звёздочка не «портит вёрстку», а роняет доставку с 400.
// ---------------------------------------------------------------------------

bot.on('message', async (ctx) => {
  const fromId = ctx.from.id;
  const message = ctx.message as any;

  if (adminToUser.has(fromId)) {
    const targetUserId = adminToUser.get(fromId)!;
    try {
      if (message.text) {
        await bot.telegram.sendMessage(
          targetUserId,
          `💬 *Менеджер:*\n${escapeMd(message.text)}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Фото, голосовое, документ — copyMessage переносит вложение как есть.
        await bot.telegram.copyMessage(targetUserId, fromId, message.message_id);
      }
    } catch (err) {
      console.error(`[support] Ошибка отправки сообщения клиенту ${targetUserId}:`, err);
      await ctx.reply('⚠️ Не удалось доставить сообщение клиенту (возможно, бот заблокирован).');
    }
    return;
  }

  if (userToAdmin.has(fromId)) {
    const targetAdminId = userToAdmin.get(fromId)!;
    const userName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Клиент';
    try {
      if (message.text) {
        await bot.telegram.sendMessage(
          targetAdminId,
          `👤 *Клиент (${escapeMd(userName)}):*\n${escapeMd(message.text)}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.telegram.sendMessage(
          targetAdminId,
          `👤 *Клиент (${escapeMd(userName)}) прислал вложение:*`,
          { parse_mode: 'Markdown' }
        );
        await bot.telegram.copyMessage(targetAdminId, fromId, message.message_id);
      }
    } catch (err) {
      console.error(`[support] Ошибка отправки сообщения админу ${targetAdminId}:`, err);
    }
    return;
  }

  // Клиент уже нажал «Связь с менеджером», но его пока никто не принял —
  // вопрос всё равно уходит всем админам вместе с кнопкой «Принять».
  if (waitingUsers.has(fromId)) {
    const userLink = ctx.from.username
      ? `@${escapeMd(ctx.from.username)}`
      : `[Профиль](tg://user?id=${fromId})`;
    const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Клиент';

    const admins = adminIds();
    const alertText =
      `🆘 *Сообщение от клиента (ждёт менеджера)*\n\n` +
      `👤 Клиент: *${escapeMd(name)}* (${userLink})\n` +
      `🆔 ID: \`${fromId}\`\n\n` +
      `💬 *Вопрос/Сообщение:*\n${escapeMd(message.text) || '[Вложение]'}`;

    for (const adminId of admins) {
      try {
        await bot.telegram.sendMessage(adminId, alertText, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(`🙋‍♂️ Принять диалог (${name})`, `take_support:${fromId}`)]
          ]),
        });
        if (!message.text) {
          await bot.telegram.copyMessage(adminId, fromId, message.message_id);
        }
      } catch (e) {
        console.error(`Failed to notify admin ${adminId}:`, e);
      }
    }

    await ctx.reply('⏳ Ваше сообщение передано менеджерам. Ожидайте ответа прямо в этом чате!');
    return;
  }

  // Команды обрабатываются своими хендлерами — на них не отвечаем подсказкой.
  if (message.text && !message.text.startsWith('/')) {
    await ctx.reply(
      'Здравствуйте! Чтобы сделать заказ или посмотреть каталог, откройте магазин.\n' +
      'Если вам нужна помощь человека, нажмите «💬 Связь с менеджером».',
      {
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🛍 Открыть магазин', WEBAPP_URL)],
          [Markup.button.callback('💬 Связь с менеджером', 'request_support')],
          [Markup.button.url('📢 Наш канал', CHANNEL_URL)]
        ])
      }
    );
  }
});

/**
 * Long polling — только для локального запуска. На Vercel бот работает вебхуком
 * (см. index.ts), поэтому launchBot() там не вызывается: лямбда не живёт между
 * апдейтами, а два способа доставки одновременно Telegram не разрешает.
 */
export function launchBot() {
  bot.launch({
    // Накопившиеся за простой апдейты пропускаем: иначе после перезапуска
    // менеджер получает лавину старых сообщений.
    dropPendingUpdates: true,
  });
  console.log('🤖 Telegram bot launched with manager support bridge');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
