// Подстановка пользовательского текста в сообщения бота.
//
// Все уведомления уходят с parse_mode: 'Markdown', и Telegram отвечает 400
// «can't parse entities», если разметка не сходится. Имя «Иван_Петров»,
// комментарий со звёздочкой или адрес с квадратной скобкой ломали не вёрстку,
// а доставку: catch вокруг sendMessage писал в лог, и менеджер просто не
// узнавал о новом заказе.
//
// Экранируем только те символы, которые Telegram считает разметкой в legacy
// Markdown: _ * ` [ — плюс сам обратный слэш, иначе экранирование
// экранирования съедает следующий символ.

const MARKDOWN_SPECIALS = /([\\_*`[])/g;

/** Готовит произвольный текст к подстановке в сообщение с parse_mode: 'Markdown'. */
export function escapeMd(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(MARKDOWN_SPECIALS, '\\$1');
}

/**
 * Для подстановки внутрь `код`. Экранирование обратным слэшем там не работает —
 * Telegram отдаёт содержимое как есть, поэтому символы, способные закрыть
 * фрагмент, просто вырезаем.
 */
export function escapeMdCode(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[`\\]/g, '');
}
