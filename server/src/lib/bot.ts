import { Telegraf, Markup } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-app.ngrok-free.app';

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required in .env');
}

export const bot = new Telegraf(BOT_TOKEN);

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

  await ctx.replyWithPhoto(
    'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?q=80&w=800&auto=format&fit=crop',
    {
      caption:
        `✨ Добро пожаловать в *MISHKIN*, ${firstName}!\n\n` +
        `Мы создаём премиальные ароматические свечи ручной работы из натурального соевого воска.\n\n` +
        `🕯 Откройте наш магазин, чтобы выбрать свой аромат:`,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🛍 Открыть магазин', WEBAPP_URL)],
        [Markup.button.url('📢 Наш канал', 'https://t.me/mishkin_candles')],
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
