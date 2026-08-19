// Виджет оплаты ЮKassa: ленивая загрузка скрипта и типы к нему.
//
// Скрипт тянем только когда пользователь дошёл до оплаты: на главной и в
// каталоге он не нужен, а это лишний внешний запрос на старте.
//
// Важно: return_url виджету НЕ передаём. По документации ЮKassa, если
// return_url задан, обработчики on('success') / on('fail') не вызываются
// вовсе, а пользователя уводит на внешнюю страницу — из Mini App это выглядит
// как вылет из Telegram. Итоговый статус всё равно берём с сервера
// (/payments/status), события виджета доказательством оплаты не считаем.

const SCRIPT_URL = 'https://yookassa.ru/checkout-widget/v1/checkout-widget.js';
const SCRIPT_ID = 'yookassa-checkout-widget';
const LOAD_TIMEOUT_MS = 15000;

export type WidgetEvent = 'success' | 'fail' | 'complete' | 'modal_close';

export interface YooKassaWidget {
  /** Рисует форму в элементе с данным id. Контейнер должен быть шире 288px. */
  render: (containerId: string) => Promise<void>;
  destroy: () => void;
  on: (event: WidgetEvent, handler: () => void) => void;
}

export interface YooKassaWidgetOptions {
  /** Одноразовый токен от ЮKassa, живёт час. */
  confirmation_token: string;
  /** Ошибки инициализации: истёкший токен, недоступный магазин и т.п. */
  error_callback?: (error: unknown) => void;
}

export type YooKassaWidgetConstructor = new (options: YooKassaWidgetOptions) => YooKassaWidget;

let loading: Promise<YooKassaWidgetConstructor> | null = null;

function getConstructor(): YooKassaWidgetConstructor | null {
  const global = window as unknown as { YooMoneyCheckoutWidget?: YooKassaWidgetConstructor };
  return global.YooMoneyCheckoutWidget ?? null;
}

/**
 * Отдаёт конструктор виджета, подгрузив скрипт при первом обращении.
 * Неудачную попытку не кэшируем — иначе один провал сети навсегда лишил бы
 * пользователя формы оплаты.
 */
export function loadPaymentWidget(): Promise<YooKassaWidgetConstructor> {
  const ready = getConstructor();
  if (ready) return Promise.resolve(ready);
  if (loading) return loading;

  loading = new Promise<YooKassaWidgetConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;

    const timer = setTimeout(
      () => reject(new Error('Форма оплаты не ответила')),
      LOAD_TIMEOUT_MS,
    );

    script.onload = () => {
      clearTimeout(timer);
      const ctor = getConstructor();
      if (ctor) resolve(ctor);
      else reject(new Error('Скрипт оплаты загрузился без виджета'));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Не удалось загрузить форму оплаты'));
    };

    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    document.getElementById(SCRIPT_ID)?.remove();
    throw error;
  });

  return loading;
}
