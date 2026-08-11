// Semantic haptic feedback engine for the Mishkin Mini App.
//
// Maps high-level user *actions* (not raw impact styles) to Telegram
// HapticFeedback when running inside Telegram, and falls back to the Web
// Vibration API (navigator.vibrate) with real millisecond patterns everywhere
// else. Short taps and long/layered buzzes are deliberately distinguished per
// action so the interface *feels* different depending on what you did.

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

// Telegram exposes no duration control, so a longer / textured buzz is
// emulated by scheduling a short sequence of impacts.
const tgSequence = (steps: Array<[ImpactStyle, number]>) => {
  let delay = 0;
  for (const [style, gap] of steps) {
    if (delay === 0) tgImpact(style);
    else setTimeout(() => tgImpact(style), delay);
    delay += gap;
  }
};

/**
 * The app's tactile vocabulary. Reach for the action that matches intent —
 * never call the Telegram API directly from components.
 */
export const haptic = {
  /** SHORT · light — routine touches: opening a card, back button. */
  tap() {
    if (hasTelegramHaptics()) tgImpact('light');
    else webVibrate(10);
  },

  /** SHORT · selection — tabs, category pills, option toggles, qty steppers. */
  select() {
    if (hasTelegramHaptics()) tgSelection();
    else webVibrate(8);
  },

  /** MEDIUM — primary button press, committing navigation. */
  press() {
    if (hasTelegramHaptics()) tgImpact('medium');
    else webVibrate(18);
  },

  /** SHORT · crisp — switches / segmented controls. */
  toggle() {
    if (hasTelegramHaptics()) tgImpact('rigid');
    else webVibrate([12]);
  },

  /** SHORT double-pulse — satisfying "added to cart" confirmation. */
  addToCart() {
    if (hasTelegramHaptics()) tgSequence([['medium', 70], ['light', 0]]);
    else webVibrate([14, 45, 22]);
  },

  /** SHORT · soft — removing / deleting an item. */
  remove() {
    if (hasTelegramHaptics()) tgImpact('soft');
    else webVibrate(22);
  },

  /** LONG · sustained heavy — long-press / press-and-hold affordances. */
  longPress() {
    if (hasTelegramHaptics()) tgSequence([['heavy', 55], ['heavy', 55], ['rigid', 0]]);
    else webVibrate(90);
  },

  /** Positive result — promo applied, saved. */
  success() {
    if (hasTelegramHaptics()) tgNotify('success');
    else webVibrate([10, 40, 80]);
  },

  /** Cautionary result. */
  warning() {
    if (hasTelegramHaptics()) tgNotify('warning');
    else webVibrate([20, 60, 20]);
  },

  /** Negative result — invalid promo, failed action. */
  error() {
    if (hasTelegramHaptics()) tgNotify('error');
    else webVibrate([40, 40, 40, 40, 40]);
  },

  /** LONG · layered celebration — order placed. */
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
