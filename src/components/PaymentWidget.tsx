import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './Icon';
import { spring } from '../utils/motion';
import { loadPaymentWidget, type YooKassaWidget } from '../utils/yookassaWidget';

/** id контейнера, в который ЮKassa рисует форму. */
const CONTAINER_ID = 'yookassa-payment-form';

interface PaymentWidgetProps {
  /** Одноразовый confirmation_token от сервера. */
  token: string;
  orderId: number;
  amount: number;
  /** Виджет сообщил об успехе. Настоящий статус всё равно спрашиваем у сервера. */
  onSuccess: () => void;
  /** Платёж не прошёл или токен истёк. */
  onFail: () => void;
  /** Форму не удалось поднять — вызывающий откатывается на страницу оплаты. */
  onUnavailable: (reason: string) => void;
  /** Пользователь закрыл форму, так и не заплатив. */
  onClose: () => void;
}

const money = (value: number) => value.toLocaleString('ru-RU');

/**
 * Форма оплаты ЮKassa прямо в Mini App — пользователь не покидает Telegram.
 *
 * Виджет живёт вне React: он сам вставляет iframe в контейнер. Поэтому
 * создаём его один раз на токен и обязательно вызываем destroy() при
 * размонтировании, иначе повторный показ формы падает.
 */
export function PaymentWidget({
  token,
  orderId,
  amount,
  onSuccess,
  onFail,
  onUnavailable,
  onClose,
}: PaymentWidgetProps) {
  const [ready, setReady] = useState(false);

  // Колбэки держим в ref: токен одноразовый, и пересоздание виджета из-за
  // «новой» функции в пропсах сожгло бы платёж.
  const handlers = useRef({ onSuccess, onFail, onUnavailable });
  handlers.current = { onSuccess, onFail, onUnavailable };

  useEffect(() => {
    let cancelled = false;
    let widget: YooKassaWidget | null = null;

    void (async () => {
      try {
        const Widget = await loadPaymentWidget();
        if (cancelled) return;

        widget = new Widget({
          confirmation_token: token,
          error_callback: (error) => {
            console.warn('[payments] виджет ЮKassa:', error);
            if (!cancelled) handlers.current.onUnavailable('Форма оплаты не открылась');
          },
        });

        widget.on('success', () => {
          widget?.destroy();
          widget = null;
          handlers.current.onSuccess();
        });
        widget.on('fail', () => {
          widget?.destroy();
          widget = null;
          handlers.current.onFail();
        });

        await widget.render(CONTAINER_ID);
        if (!cancelled) setReady(true);
      } catch (error) {
        if (!cancelled) handlers.current.onUnavailable((error as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      try {
        widget?.destroy();
      } catch {
        // Виджет мог уничтожить себя сам после success/fail — это не ошибка.
      }
    };
  }, [token]);

  return (
    <motion.div
      className="fixed inset-0 z-sheet flex flex-col bg-background-light"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={spring.soft}
      role="dialog"
      aria-modal="true"
      aria-label={`Оплата заказа №${orderId}`}
    >
      <header className="flex items-center gap-3 border-b border-line/60 px-4 pb-3.5 pt-[calc(var(--app-top)+0.875rem)]">
        <button
          onClick={onClose}
          aria-label="Закрыть оплату"
          className="flex size-9 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90"
        >
          <Icon name="close" size={18} />
        </button>
        <div className="text-left">
          <p className="font-display text-base font-bold text-text-main">Оплата заказа №{orderId}</p>
          <p className="text-2xs text-text-sub">{money(amount)} ₽ · защищённая форма ЮKassa</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pb-[calc(1.5rem+var(--safe-bottom))] pt-4">
        {!ready && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Icon name="spinner" size={28} className="animate-spin-slow text-primary/60" />
            <p className="text-sm text-text-sub">Готовим форму оплаты…</p>
          </div>
        )}
        {/* Контейнер виджета: ЮKassa требует ширину не меньше 288px. */}
        <div id={CONTAINER_ID} className="mx-auto min-w-[288px] max-w-md" />
      </div>
    </motion.div>
  );
}
