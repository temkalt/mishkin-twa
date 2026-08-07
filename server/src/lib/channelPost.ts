import { Markup } from 'telegraf';
import { bot } from './bot.js';

/**
 * Генерирует прямую ссылку на Mini App (Direct Link).
 * Формат: https://t.me/bot_username/app_name?startapp=param
 */
export function buildMiniAppUrl(startParam?: string): string {
  const botUsername = process.env.BOT_USERNAME || 'mishkin_candles_bot'; // Замените на реальный юзернейм вашего бота
  const appName = process.env.BOT_APP_NAME; // Если есть app_name в BotFather

  let url = `https://t.me/${botUsername}`;
  
  if (appName) {
    url += `/${appName}`;
  }

  const finalStartParam = startParam || process.env.CHANNEL_POST_START_PARAM || 'channel';
  url += `?startapp=${encodeURIComponent(finalStartParam)}`;

  return url;
}

/**
 * Создает инлайн-клавиатуру для поста с URL-кнопкой
 */
export function buildChannelKeyboard(buttonText: string, startParam?: string) {
  const url = buildMiniAppUrl(startParam);
  return Markup.inlineKeyboard([
    Markup.button.url(buttonText, url)
  ]);
}

/**
 * Проверяет, есть ли у бота права администратора в указанном канале
 */
export async function checkBotIsAdmin(channelId: string): Promise<boolean> {
  try {
    const botInfo = await bot.telegram.getMe();
    const member = await bot.telegram.getChatMember(channelId, botInfo.id);
    return member.status === 'administrator' || member.status === 'creator';
  } catch (error) {
    console.error('Error checking bot admin status:', error);
    return false;
  }
}

/**
 * Публикует пост (текст или фото) в канал
 */
export async function publishPost(
  channelId: string, 
  text: string, 
  photoUrl?: string, 
  buttonText?: string, 
  startParam?: string
) {
  const btnText = buttonText || process.env.CHANNEL_POST_BUTTON_TEXT || '🛍 Открыть приложение';
  const keyboard = buildChannelKeyboard(btnText, startParam);

  if (photoUrl) {
    return await bot.telegram.sendPhoto(channelId, photoUrl, {
      caption: text,
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  } else {
    return await bot.telegram.sendMessage(channelId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
      link_preview_options: { is_disabled: true }
    });
  }
}
