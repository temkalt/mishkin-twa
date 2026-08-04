import { Telegraf, Markup } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = 'https://mishkin-twa.vercel.app';

if (!BOT_TOKEN) {
  console.error('CRITICAL: BOT_TOKEN is missing!');
}

export const bot = new Telegraf(BOT_TOKEN || 'dummy_token');

// /start command
bot.start(async (ctx) => {
  const firstName = ctx.from.first_name || 'друг';

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
        [Markup.button.url('📢 Наш канал', 'https://t.me/mishkin_candles')]
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
