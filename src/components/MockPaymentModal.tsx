import { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './Icon';
import { spring } from '../utils/motion';
import { haptic } from '../utils/haptics';
import { api } from '../utils/api';

interface MockPaymentModalProps {
  paymentId: string;
  orderId: number;
  amount: number;
  confirmationUrl?: string;
  onSuccess: () => void;
  onFail: () => void;
  onClose: () => void;
}

const money = (value: number) => value.toLocaleString('ru-RU');

export function MockPaymentModal({
  paymentId,
  orderId,
  amount,
  confirmationUrl,
  onSuccess,
  onFail,
  onClose,
}: MockPaymentModalProps) {
  const [submitting, setSubmitting] = useState<'success' | 'fail' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleResolve = async (outcome: 'succeeded' | 'canceled') => {
    setSubmitting(outcome === 'succeeded' ? 'success' : 'fail');
    setErrorMsg('');
    haptic.press();

    try {
      await api.post(`/payments/mock/${encodeURIComponent(paymentId)}/${outcome}`, {});
      if (outcome === 'succeeded') {
        haptic.celebrate();
        onSuccess();
      } else {
        haptic.error();
        onFail();
      }
    } catch (err) {
      setErrorMsg((err as Error).message || 'Ошибка связи с сервером');
      haptic.error();
      setSubmitting(null);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-sheet flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Тестовая оплата"
    >
      <motion.div
        className="w-full max-w-md rounded-t-3xl bg-background-light p-6 pb-[calc(2rem+var(--safe-bottom))] shadow-2xl sm:rounded-3xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring.soft}
      >
        {/* Banner */}
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-700">
          <Icon name="alert" size={16} className="shrink-0" />
          <span>Тестовый режим оплаты (Демо)</span>
        </div>

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-text-main">Оплата заказа №{orderId}</h3>
            <p className="text-2xs text-text-sub">Денежные средства списаны не будут</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="flex size-8 items-center justify-center rounded-full bg-pastel-sand/30 text-text-sub transition-transform active:scale-90"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Amount & Fake Card */}
        <div className="mb-5 rounded-2xl bg-white p-4 shadow-soft">
          <p className="text-xs text-text-sub">Сумма к оплате</p>
          <p className="my-1 font-display text-3xl font-bold tabular-nums text-text-main">
            {money(amount)} ₽
          </p>

          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-3 text-xs text-text-sub">
            <span className="flex items-center gap-1.5 font-medium">
              <Icon name="card" size={15} className="text-primary" />
              Карта (эмулятор)
            </span>
            <span className="font-mono font-semibold text-text-main">4111 11•• •••• 1111</span>
          </div>
        </div>

        {errorMsg && (
          <p className="mb-3 text-center text-xs font-medium text-danger">{errorMsg}</p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => void handleResolve('succeeded')}
            disabled={submitting !== null}
            className="btn-primary flex items-center justify-center gap-2 py-3.5 font-bold"
          >
            {submitting === 'success' ? (
              <>
                <Icon name="spinner" size={18} className="animate-spin-slow" />
                Подтверждаем…
              </>
            ) : (
              <>
                <Icon name="check_circle" size={18} />
                Оплатить {money(amount)} ₽ (демо)
              </>
            )}
          </button>

          <button
            onClick={() => void handleResolve('canceled')}
            disabled={submitting !== null}
            className="flex items-center justify-center gap-2 rounded-xl border border-danger/30 py-2.5 text-xs font-bold text-danger transition-colors hover:bg-danger/5 active:scale-98"
          >
            {submitting === 'fail' ? (
              <>
                <Icon name="spinner" size={14} className="animate-spin-slow" />
                Отклоняем…
              </>
            ) : (
              'Смоделировать отказ банка'
            )}
          </button>

          {confirmationUrl && (
            <a
              href={confirmationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-center text-2xs font-semibold text-text-sub underline underline-offset-2 hover:text-text-main"
            >
              Открыть страницу эмулятора в браузере →
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
