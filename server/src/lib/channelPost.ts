// Публикация постов в канал с кнопкой, открывающей Mini App.

import { Markup } from 'telegraf';
import { bot } from './bot.js';

/**
 * Прямая ссылка на Mini App: https://t.me/<bot>/<app>?startapp=<param>.
 *
 * BOT_USERNAME обязателен и подставлять «разумное» значение по умолчанию нельзя:
 * здесь стоял хардкод чужого юзернейма, и при незаданной переменной кнопка в
 * канале вела в постороннего бота. Лучше явная ошибка настройки.
 */
export function buildMiniAppUrl(startParam?: string): string {
  const botUsername = (process.env.BOT_USERNAME || '').replace(/^@/, '').trim();
  if (!botUsername) {
    throw Object.assign(new Error('BOT_USERNAME не задан — ссылку на приложение построить нельзя'), {
      status: 500,
    });
  }

  // app_name из BotFather: без него ссылка ведёт в бота, а не сразу в приложение.
  const appName = process.env.BOT_APP_NAME;
  let url = `https://t.me/${encodeURIComponent(botUsername)}`;
  if (appName) url += `/${encodeURIComponent(appName)}`;

  const finalStartParam = startParam || process.env.CHANNEL_POST_START_PARAM || 'channel';
  return `${url}?startapp=${encodeURIComponent(finalStartParam)}`;
}

export function buildChannelKeyboard(buttonText: string, startParam?: string) {
  return Markup.inlineKeyboard([Markup.button.url(buttonText, buildMiniAppUrl(startParam))]);
}

/**
 * Бот должен быть администратором канала — иначе публикация упадёт уже после
 * того, как админка отрапортует об успехе. Проверяем заранее, чтобы вернуть
 * понятную причину.
 */
export async function checkBotIsAdmin(channelId: string): Promise<boolean> {
  try {
    const botInfo = await bot.telegram.getMe();
    const member = await bot.telegram.getChatMember(channelId, botInfo.id);
    return member.status === 'administrator' || member.status === 'creator';
  } catch (error) {
    console.error('[channel] не удалось проверить права бота:', error);
    return false;
  }
}

export async function publishPost(
  channelId: string,
  text: string,
  photoUrl?: string,
  buttonText?: string,
  startParam?: string,
) {
  const btnText = buttonText || process.env.CHANNEL_POST_BUTTON_TEXT || '🛍 Открыть приложение';
  const keyboard = buildChannelKeyboard(btnText, startParam);

  // Текст поста пишет админ и разметка в нём осознанная — не экранируем.
  if (photoUrl) {
    return bot.telegram.sendPhoto(channelId, photoUrl, {
      caption: text,
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
    });
  }

  return bot.telegram.sendMessage(channelId, text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup,
    link_preview_options: { is_disabled: true },
  });
}
