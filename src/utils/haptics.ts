// Тактильная отдача по смыслу действия, а не по силе удара.
//
// Компоненты вызывают haptic.tap() / haptic.success() и не знают, где выполняются:
// внутри Telegram работает HapticFeedback, в браузере — navigator.vibrate с
// настоящими миллисекундными паттернами. Разделение «короткое касание» против
// «длинного слоистого» сделано осознанно: добавление товара и ошибка оплаты должны
// ощущаться по-разному, иначе тактильная отдача превращается в шум.

import { getWebApp } from './telegram';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'success' | 'warning' | 'error';

const hasTelegramHaptics = (): boolean => {
  const w = getWebApp();
  return !!(w && w.initData && w.HapticFeedback);
};

const tgImpact = (style: ImpactStyle) => {
  const w = getWebApp();
  try { w?.HapticFeedback?.impactOccurred(style); } catch { /* noop */ }
};

const tgNotify = (type: NotificationType) => {
  const w = getWebApp();
  try { w?.HapticFeedback?.notificationOccurred(type); } catch { /* noop */ }
};

const tgSelection = () => {
  const w = getWebApp();
  try { w?.HapticFeedback?.selectionChanged(); } catch { /* noop */ }
};

const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const webVibrate = (pattern: number | number[]) => {
  if (!canVibrate()) return;
  try { navigator.vibrate(pattern); } catch { /* noop */ }
};

// Длительностью вибрации Telegram управлять не даёт — только «стилем удара».
// Долгую или «текстурную» отдачу приходится собирать из нескольких коротких
// импульсов с паузами.
const tgSequence = (steps: Array<[ImpactStyle, number]>) => {
  let delay = 0;
  for (const [style, gap] of steps) {
    if (delay === 0) tgImpact(style);
    else setTimeout(() => tgImpact(style), delay);
    delay += gap;
  }
};

/**
 * Тактильный словарь приложения. Из компонентов вызываем действие по смыслу
 * (tap, addToCart, celebrate) и никогда не трогаем HapticFeedback напрямую:
 * иначе браузерная ветка теряется и вне Telegram отдачи нет вообще.
 */
export const haptic = {
  /** Короткое лёгкое — рядовые касания: открыть карточку, кнопка «назад». */
  tap() {
    if (hasTelegramHaptics()) tgImpact('light');
    else webVibrate(10);
  },

  /** Выбор — табы, категории, переключение опций, счётчик количества. */
  select() {
    if (hasTelegramHaptics()) tgSelection();
    else webVibrate(8);
  },

  /** Среднее — нажатие главной кнопки, переход, который что-то подтверждает. */
  press() {
    if (hasTelegramHaptics()) tgImpact('medium');
    else webVibrate(18);
  },

  /** Резкое короткое — тумблеры и сегментированные переключатели. */
  toggle() {
    if (hasTelegramHaptics()) tgImpact('rigid');
    else webVibrate([12]);
  },

  /** Двойной импульс — «товар добавлен», должно ощущаться как щелчок защёлки. */
  addToCart() {
    if (hasTelegramHaptics()) tgSequence([['medium', 70], ['light', 0]]);
    else webVibrate([14, 45, 22]);
  },

  /** Мягкое — удаление товара: убирающее действие не должно быть резким. */
  remove() {
    if (hasTelegramHaptics()) tgImpact('soft');
    else webVibrate(22);
  },

  /** Долгое насыщенное — долгое нажатие и удержание. */
  longPress() {
    if (hasTelegramHaptics()) tgSequence([['heavy', 55], ['heavy', 55], ['rigid', 0]]);
    else webVibrate(90);
  },

  /** Успех — промокод применён, изменения сохранены. */
  success() {
    if (hasTelegramHaptics()) tgNotify('success');
    else webVibrate([10, 40, 80]);
  },

  /** Предупреждение. */
  warning() {
    if (hasTelegramHaptics()) tgNotify('warning');
    else webVibrate([20, 60, 20]);
  },

  /** Отказ — неверный промокод, неудавшееся действие. */
  error() {
    if (hasTelegramHaptics()) tgNotify('error');
    else webVibrate([40, 40, 40, 40, 40]);
  },

  /** Долгое многослойное — заказ оформлен, единственное «празднование» в приложении. */
  celebrate() {
    if (hasTelegramHaptics()) {
      tgNotify('success');
      tgSequence([['heavy', 90], ['medium', 70], ['light', 70], ['rigid', 0]]);
    } else {
      webVibrate([12, 50, 18, 50, 28, 90, 60]);
    }
  },
};

export type Haptic = typeof haptic;
