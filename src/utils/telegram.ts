// Доступ к Telegram WebApp.
//
// SDK-пакет не используем сознательно: он захватывает window.Telegram на
// момент импорта, а в Telegram-webview скрипт telegram-web-app.js иногда
// подгружается позже модулей — из-за этого initData приходил пустым.
// Прокси ниже читает объект в момент обращения, поэтому гонки нет.

interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebAppLike {
  initData: string;
  initDataUnsafe?: { user?: TelegramWebAppUser; start_param?: string };
  ready: () => void;
  expand: () => void;
  requestFullscreen?: () => void;
  close?: () => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    show: () => void;
    hide: () => void;
  };
  BackButton: { show: () => void; hide: () => void };
  HapticFeedback?: {
    impactOccurred: (style: string) => void;
    notificationOccurred: (type: string) => void;
    selectionChanged: () => void;
  };
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
}

export const getWebApp = (): TelegramWebAppLike | null => {
  if (typeof window === 'undefined') return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppLike } }).Telegram;
  return tg?.WebApp ?? null;
};

/** Открыто ли приложение действительно внутри Telegram (а не в браузере). */
export const isInTelegram = (): boolean => Boolean(getWebApp()?.initData);

const BRAND_BG = '#FDFBF7';

/**
 * Единая инициализация. Раньше вызывалась и в main.tsx, и в App.tsx —
 * ready()/expand() дважды, а цвета оболочки не задавались вовсе, из-за чего
 * шапка Telegram оставалась дефолтной и не совпадала с фоном магазина.
 */
export function initTelegram(): void {
  const webApp = getWebApp();
  if (!webApp) return;

  try {
    webApp.ready();
    webApp.expand();
    webApp.requestFullscreen?.();

    // Оболочка Telegram в цвет магазина — иначе видна серая полоса сверху.
    webApp.setHeaderColor?.(BRAND_BG);
    webApp.setBackgroundColor?.(BRAND_BG);
    webApp.setBottomBarColor?.(BRAND_BG);

    // Свайп вниз закрывал приложение при скролле длинного каталога.
    webApp.disableVerticalSwipes?.();
  } catch (error) {
    console.warn('Telegram WebApp init failed', error);
  }
}

export const WebApp = new Proxy({} as TelegramWebAppLike, {
  get(_target, prop) {
    const webApp = getWebApp();
    if (webApp) {
      const value = (webApp as unknown as Record<string | symbol, unknown>)[prop];
      if (typeof value === 'function') {
        return (value as (...args: unknown[]) => unknown).bind(webApp);
      }
      return value;
    }
    return undefined;
  },
  set(_target, prop, value) {
    const webApp = getWebApp();
    if (webApp) {
      (webApp as unknown as Record<string | symbol, unknown>)[prop] = value;
      return true;
    }
    return false;
  },
});
