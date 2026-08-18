import { Telegraf, Markup } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = (process.env.WEBAPP_URL || 'https://mishkin-twa.vercel.app').replace(/\/+$/, '');
const CHANNEL_URL = process.env.CHANNEL_URL || 'https://t.me/mishkin_candles';

if (!BOT_TOKEN) {
  console.error('CRITICAL: BOT_TOKEN is missing!');
}

export const bot = new Telegraf(BOT_TOKEN || 'dummy_token');

import { prisma } from './prisma.js';

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
    `Добро пожаловать в *MISHKIN*, ${firstName}!\n\nНажмите кнопку ниже, чтобы открыть каталог свечей.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🛍 Открыть магазин', WEBAPP_URL)],
        [Markup.button.url('📢 Наш канал', CHANNEL_URL)]
      ]),
    }
  );
});

// /help command
bot.help((ctx) => {
  ctx.reply(
    '🕯 *MISHKIN — Свечи ручной работы*\n\n' +
    'Нажмите кнопку ниже, чтобы открыть магазин:\n' +
    '/start — Открыть главное меню',
    { parse_mode: 'Markdown' }
  );
});

export function launchBot() {
  bot.launch({
    dropPendingUpdates: true,
  });
  console.log('🤖 Telegram bot launched');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
