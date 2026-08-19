import { Telegraf, Markup } from 'telegraf';
import { prisma } from './prisma.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = (process.env.WEBAPP_URL || 'https://mishkin-twa.vercel.app').replace(/\/+$/, '');
const CHANNEL_URL = process.env.CHANNEL_URL || 'https://t.me/mishkin_candles';

if (!BOT_TOKEN) {
  console.error('CRITICAL: BOT_TOKEN is missing!');
}

export const bot = new Telegraf(BOT_TOKEN || 'dummy_token');

// ==========================================
// СИСТЕМА ДИАЛОГОВ ПОДДЕРЖКИ (МЕНЕДЖЕР <-> КЛИЕНТ)
// ==========================================

/** Привязка: ID пользователя -> ID админа, который ведет диалог */
const userToAdmin = new Map<number, number>();

/** Привязка: ID админа -> ID пользователя, с которым открыт диалог */
const adminToUser = new Map<number, number>();

/** Пользователи, ожидающие ответа менеджера: ID -> данные */
interface WaitingUser {
  name: string;
  username?: string;
  requestedAt: Date;
  initialQuestion?: string;
}
const waitingUsers = new Map<number, WaitingUser>();

function getAdminIds(): number[] {
  return (process.env.ADMIN_IDS || '')
    .replace(/["']/g, '')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => Number.isFinite(id) && id > 0);
}

/** Инициация запроса на связь с менеджером */
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

  // Уведомляем всех администраторов
  const admins = getAdminIds();
  const userLink = tgUser.username ? `@${tgUser.username}` : `[Профиль](tg://user?id=${userId})`;
  const alertText =
    `🆘 *Запрос помощи от клиента!*\n\n` +
    `👤 Клиент: *${name}* (${userLink})\n` +
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

/** Завершение сессии поддержки */
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

// ==========================================
// КОМАНДЫ БОТА
// ==========================================

// /start command
bot.start(async (ctx) => {
  const tgUser = ctx.from;
  const firstName = tgUser.first_name || 'друг';

  // Сохраняем/обновляем пользователя в базе для статистики
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

  await ctx.reply(
    `Добро пожаловать в *MISHKIN*, ${firstName}!\n\n` +
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

// /support, /help, /manager commands
bot.command(['support', 'manager'], initiateSupportRequest);

// Кнопка "💬 Связь с менеджером"
bot.action('request_support', async (ctx) => {
  await ctx.answerCbQuery();
  await initiateSupportRequest(ctx);
});

// Отмена запроса клиентом
bot.action(/^cancel_support:(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1], 10);
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

// Принятие диалога администратором
bot.action(/^take_support:(\d+)$/, async (ctx) => {
  const targetUserId = parseInt(ctx.match[1], 10);
  const adminId = ctx.from.id;
  const adminName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Менеджер';

  // Проверка прав администратора
  const admins = getAdminIds();
  if (!admins.includes(adminId)) {
    await ctx.answerCbQuery('⚠️ У вас нет прав администратора', { show_alert: true });
    return;
  }

  // Проверка: занят ли диалог
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

  // Проверка: не ведёт ли этот админ уже диалог с кем-то ещё
  if (adminToUser.has(adminId)) {
    const activeClient = adminToUser.get(adminId);
    await ctx.answerCbQuery(
      `У вас уже открыт диалог с клиентом (ID: ${activeClient}). Завершите его командой /close перед началом нового.`,
      { show_alert: true }
    );
    return;
  }

  // Закрепляем сессию
  userToAdmin.set(targetUserId, adminId);
  adminToUser.set(adminId, targetUserId);
  const waitingInfo = waitingUsers.get(targetUserId);
  waitingUsers.delete(targetUserId);

  await ctx.answerCbQuery('✅ Вы подключились к диалогу!');

  try {
    await ctx.editMessageText(
      `✅ *Вы подключились к диалогу с клиентом ${waitingInfo?.name || ''} (ID: \`${targetUserId}\`)*\n\n` +
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

  // Уведомляем клиента
  try {
    await bot.telegram.sendMessage(
      targetUserId,
      `👨‍💼 *Менеджер ${adminName} подключился к диалогу!*\n\n` +
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

// Завершение диалога по кнопке
bot.action(/^close_support:(\d+)$/, async (ctx) => {
  const userId = parseInt(ctx.match[1], 10);
  const callerId = ctx.from.id;

  // Завершить может либо сам клиент, либо назначенный админ
  if (callerId === userId || userToAdmin.get(userId) === callerId) {
    await ctx.answerCbQuery('Диалог завершается...');
    await closeSupportSession(userId, userToAdmin.get(userId));
  } else {
    await ctx.answerCbQuery('Вы не участвуете в этом диалоге', { show_alert: true });
  }
});

// Команда /close или /stop для завершения диалога
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

// /help command
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

// ==========================================
// МАРШРУТИЗАЦИЯ СООБЩЕНИЙ (ПЕРЕСЫЛКА)
// ==========================================

bot.on('message', async (ctx) => {
  const fromId = ctx.from.id;
  const message = ctx.message as any;

  // 1. Сообщение от АДМИНИСТРАТОРА клиенту
  if (adminToUser.has(fromId)) {
    const targetUserId = adminToUser.get(fromId)!;
    try {
      if (message.text) {
        await bot.telegram.sendMessage(
          targetUserId,
          `💬 *Менеджер:*\n${message.text}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.telegram.copyMessage(targetUserId, fromId, message.message_id);
      }
    } catch (err) {
      console.error(`[support] Ошибка отправки сообщения клиенту ${targetUserId}:`, err);
      await ctx.reply('⚠️ Не удалось доставить сообщение клиенту (возможно, бот заблокирован).');
    }
    return;
  }

  // 2. Сообщение от КЛИЕНТА администратору (активный диалог)
  if (userToAdmin.has(fromId)) {
    const targetAdminId = userToAdmin.get(fromId)!;
    const userName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Клиент';
    try {
      if (message.text) {
        await bot.telegram.sendMessage(
          targetAdminId,
          `👤 *Клиент (${userName}):*\n${message.text}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.telegram.sendMessage(
          targetAdminId,
          `👤 *Клиент (${userName}) прислал вложение:*`,
          { parse_mode: 'Markdown' }
        );
        await bot.telegram.copyMessage(targetAdminId, fromId, message.message_id);
      }
    } catch (err) {
      console.error(`[support] Ошибка отправки сообщения админу ${targetAdminId}:`, err);
    }
    return;
  }

  // 3. Сообщение от КЛИЕНТА, который нажал "Связь с менеджером" и пишет свой вопрос
  if (waitingUsers.has(fromId)) {
    const userLink = ctx.from.username ? `@${ctx.from.username}` : `[Профиль](tg://user?id=${fromId})`;
    const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ') || 'Клиент';

    const admins = getAdminIds();
    const alertText =
      `🆘 *Сообщение от клиента (ждёт менеджера)*\n\n` +
      `👤 Клиент: *${name}* (${userLink})\n` +
      `🆔 ID: \`${fromId}\`\n\n` +
      `💬 *Вопрос/Сообщение:*\n${message.text || '[Вложение]'}`;

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

  // 4. Обычное текстовое сообщение вне диалога — подсказываем меню
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

export function launchBot() {
  bot.launch({
    dropPendingUpdates: true,
  });
  console.log('🤖 Telegram bot launched with manager support bridge');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
