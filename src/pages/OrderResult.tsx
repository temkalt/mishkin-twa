import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { WebApp } from '../utils/telegram';
import { api } from '../utils/api';
import { haptic } from '../utils/haptics';
import { Icon } from '../components/Icon';
import { PaymentWidget } from '../components/PaymentWidget';
import { MockPaymentModal } from '../components/MockPaymentModal';
import { EASE_OUT, spring } from '../utils/motion';
import type { PaymentStartResponse, PaymentStatusResponse } from '../utils/types';

const money = (value: number) => value.toLocaleString('ru-RU');

const POLL_INTERVAL_MS = 2500;
const POLL_LIMIT_MS = 5 * 60 * 1000;

const METHOD_LABELS: Record<string, string> = {
  bank_card: 'банковская карта',
  sbp: 'СБП',
  yoo_money: 'ЮMoney',
  sberbank: 'SberPay',
};

/**
 * Экран заказа: запускает оплату, ждёт её и показывает результат.
 *
 * Здесь единственная точка запуска платежа — чекаут только приводит сюда с
 * `state.autoPay`. Так вся развилка «виджет или страница ЮKassa» живёт в одном
 * месте, а адрес /order/:id остаётся устойчивым: если оплата всё же ушла во
 * внешний браузер, Telegram вернёт пользователя сюда по deep-link, даже когда
 * приложение за это время закрылось.
 */
export function OrderResult() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();

  const [data, setData] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payError, setPayError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [pollExpired, setPollExpired] = useState(false);
  /** Непустой токен = показываем форму оплаты поверх страницы. */
  const [widgetToken, setWidgetToken] = useState('');
  /** Данные для встроенного эмулятора тестовой оплаты */
  const [mockModal, setMockModal] = useState<{ paymentId: string; amount: number; confirmationUrl?: string } | null>(null);
  const celebrated = useRef(false);
  // Защита от двойного запуска: state-флаг для этого не годится, он приходит
  // на следующий рендер, а автозапуск и тап по кнопке могут случиться подряд.
  const paying = useRef(false);
  const autoPayDone = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await api.get<PaymentStatusResponse>(`/payments/status/${orderId}`);
      setData(result);
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Не удалось получить статус заказа');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!Number.isInteger(orderId) || orderId <= 0) {
      setError('Некорректный номер заказа');
      setLoading(false);
      return;
    }
    void fetchStatus();
  }, [orderId, fetchStatus]);

  // Пока платёж в процессе — переспрашиваем статус: вебхук мог не дойти.
  useEffect(() => {
    if (data?.paymentStatus !== 'PENDING') return;

    const interval = setInterval(() => void fetchStatus(), POLL_INTERVAL_MS);
    const stop = setTimeout(() => {
      clearInterval(interval);
      setPollExpired(true);
    }, POLL_LIMIT_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [data?.paymentStatus, fetchStatus]);

  useEffect(() => {
    if (data?.paymentStatus !== 'PAID') return;
    // Оплата подтверждена сервером — форма больше не нужна, даже если её
    // закрыл вебхук, а не пользователь.
    setWidgetToken('');
    setMockModal(null);
    if (!celebrated.current) {
      celebrated.current = true;
      haptic.celebrate();
      localStorage.removeItem('mishkin_last_order');
    }
  }, [data?.paymentStatus]);

  /**
   * Запускает оплату заказа.
   *
   * По умолчанию сервер отдаёт токен виджета — форма открывается здесь же.
   * В тестовом режиме эмулятора открываем аккуратный модальный эмулятор.
   */
  const startPayment = useCallback(async (mode?: 'redirect') => {
    if (paying.current) return;
    paying.current = true;
    setRetrying(true);
    setPayError('');
    try {
      const started = await api.post<PaymentStartResponse>('/payments/create', {
        orderId,
        ...(mode ? { mode } : {}),
      });
      haptic.press();

      if (started.mock) {
        setMockModal({
          paymentId: started.paymentId,
          amount: started.amount || (data ? data.totalPrice : 0),
          confirmationUrl: started.confirmationUrl,
        });
      } else if (started.confirmationToken) {
        setWidgetToken(started.confirmationToken);
      } else if (started.confirmationUrl) {
        if (WebApp.initData && WebApp.openLink) {
          try {
            WebApp.openLink(started.confirmationUrl);
          } catch {
            window.location.href = started.confirmationUrl;
          }
        } else {
          window.location.href = started.confirmationUrl;
        }
      } else {
        throw new Error('Сервер не вернул способ оплаты');
      }

      setPollExpired(false);
      await fetchStatus();
    } catch (err) {
      setPayError((err as Error).message || 'Не удалось открыть оплату');
      haptic.error();
    } finally {
      paying.current = false;
      setRetrying(false);
    }
  }, [orderId, data, fetchStatus]);

  // Из чекаута приходим уже готовыми платить — второго нажатия не просим.
  useEffect(() => {
    if (autoPayDone.current) return;
    if (!(location.state as { autoPay?: boolean } | null)?.autoPay) return;
    if (!Number.isInteger(orderId) || orderId <= 0) return;
    autoPayDone.current = true;
    void startPayment();
  }, [location.state, orderId, startPayment]);

  const closeWidget = useCallback(() => setWidgetToken(''), []);

  const handleWidgetSuccess = useCallback(() => {
    setWidgetToken('');
    // Событие виджета — не доказательство оплаты, статус берём с сервера.
    void fetchStatus();
  }, [fetchStatus]);

  const handleWidgetFail = useCallback(() => {
    setWidgetToken('');
    setPayError('Оплата не прошла. Деньги не списаны — можно попробовать снова.');
    haptic.error();
    void fetchStatus();
  }, [fetchStatus]);

  const handleWidgetUnavailable = useCallback((reason: string) => {
    setWidgetToken('');
    console.warn('[payments] форма не открылась, уходим на страницу ЮKassa:', reason);
    void startPayment('redirect');
  }, [startPayment]);

  if (loading) {
    return (
      <div className="mesh-bg flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <Icon name="spinner" size={30} className="animate-spin-slow text-primary/60" />
        <p className="text-sm text-text-sub">Проверяем заказ…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mesh-bg flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-danger/10">
          <Icon name="alert" size={28} className="text-danger" />
        </div>
        <h2 className="mb-2 font-display text-xl font-bold text-text-main">Не получилось загрузить</h2>
        <p className="mb-7 max-w-[280px] text-sm text-text-sub">{error}</p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button onClick={() => { haptic.tap(); setLoading(true); void fetchStatus(); }} className="btn-primary">
            Повторить
          </button>
          <button onClick={() => navigate('/')} className="btn-ghost">На главную</button>
        </div>
      </div>
    );
  }

  const isPaid = data.paymentStatus === 'PAID';
  const isPending = data.paymentStatus === 'PENDING';
  const isFailed = data.paymentStatus === 'CANCELED';
  const isManual = data.paymentType === 'MANUAL';

  return (
    <>
    <motion.div
      className="mesh-bg grain flex min-h-screen flex-col items-center justify-center px-6 pb-[calc(2.5rem+var(--safe-bottom))] pt-[calc(var(--app-top)+2.5rem)] text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* ===== ИКОНКА СОСТОЯНИЯ ===== */}
      <div className="relative mb-6 flex items-center justify-center">
        {isPaid && [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border-2 border-primary/40"
            style={{ width: 80, height: 80 }}
            initial={{ scale: 0.6, opacity: 0.6 }}
            animate={{ scale: 2.4 + i * 0.5, opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.2 + i * 0.18, ease: EASE_OUT }}
          />
        ))}

        <motion.div
          className={`relative flex size-20 items-center justify-center rounded-full ${
            isPaid ? 'bg-primary/10 glow-primary' : isFailed ? 'bg-danger/10' : 'bg-accent/15'
          }`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, ...spring.bouncy }}
        >
          {isPending ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
              className="text-accent-deep"
            >
              <Icon name="spinner" size={36} />
            </motion.span>
          ) : (
            <Icon
              name={isPaid ? 'check_circle' : isFailed ? 'cancel' : 'receipt_long'}
              size={38}
              className={isPaid ? 'text-primary' : isFailed ? 'text-danger' : 'text-accent-deep'}
            />
          )}
        </motion.div>
      </div>

      {/* ===== ТЕКСТ ===== */}
      <motion.h1
        className="mb-2 font-display text-2xl font-bold text-text-main"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        {isPaid ? 'Оплачено!' : isFailed ? 'Оплата не прошла' : isManual ? 'Заказ принят' : 'Ждём оплату'}
      </motion.h1>

      <p className="mb-1 text-sm text-text-sub">Заказ №{data.orderId}</p>
      <p className="mb-1 text-xl font-bold tabular-nums text-text-main">{money(data.totalPrice)} ₽</p>
      {isPaid && data.paymentMethod && (
        <p className="mb-1 text-2xs uppercase tracking-wider text-text-sub">
          {METHOD_LABELS[data.paymentMethod] || data.paymentMethod}
        </p>
      )}

      <motion.p
        className="mb-8 mt-3 max-w-[300px] text-sm leading-relaxed text-text-sub"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        {isPaid
          ? 'Мы уже собираем ваш заказ и свяжемся по доставке.'
          : isFailed
          ? 'Деньги не списаны. Можно попробовать оплатить ещё раз.'
          : isManual
          ? 'Менеджер свяжется с вами, чтобы согласовать оплату и доставку.'
          : pollExpired
          ? 'Мы перестали проверять автоматически. Нажмите «Проверить оплату», если платёж прошёл.'
          : 'Завершите оплату — статус обновится здесь автоматически.'}
      </motion.p>

      {/* ===== ОШИБКА ЗАПУСКА ОПЛАТЫ ===== */}
      <AnimatePresence>
        {payError && (
          <motion.p
            className="mb-4 flex max-w-xs items-start gap-2 rounded-xl bg-danger/10 p-3 text-left text-2xs text-danger"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Icon name="alert" size={14} className="mt-px shrink-0" /> {payError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ===== ДЕЙСТВИЯ ===== */}
      <div className="flex w-full max-w-xs flex-col gap-2.5">
        {(isPending || isFailed) && (
          <motion.button
            className="btn-primary"
            whileTap={{ scale: 0.98 }}
            onClick={() => { haptic.press(); void startPayment(); }}
            disabled={retrying}
          >
            <span className="relative flex items-center justify-center gap-2">
              {retrying ? (
                <><Icon name="spinner" size={18} className="animate-spin-slow" /> Открываем…</>
              ) : (
                <><Icon name="card" size={18} /> {isFailed ? 'Оплатить снова' : 'Оплатить'}</>
              )}
            </span>
          </motion.button>
        )}

        {isPending && (
          <button
            className="btn-ghost"
            onClick={() => { haptic.tap(); void fetchStatus(); }}
          >
            Проверить оплату
          </button>
        )}

        <button
          className={isPaid || isManual ? 'btn-primary' : 'btn-ghost'}
          onClick={() => { haptic.tap(); navigate('/orders'); }}
        >
          {isPaid || isManual ? 'Мои заказы' : 'К моим заказам'}
        </button>

        <button
          className="py-2 text-sm font-medium text-text-sub transition-colors active:text-text-main"
          onClick={() => { haptic.tap(); navigate('/'); }}
        >
          На главную
        </button>
      </div>
    </motion.div>

    {/* Форма ЮKassa поверх страницы: опрос статуса под ней продолжается. */}
    <AnimatePresence>
      {widgetToken && (
        <PaymentWidget
          key={widgetToken}
          token={widgetToken}
          orderId={data.orderId}
          amount={data.totalPrice}
          onSuccess={handleWidgetSuccess}
          onFail={handleWidgetFail}
          onUnavailable={handleWidgetUnavailable}
          onClose={closeWidget}
        />
      )}

      {mockModal && (
        <MockPaymentModal
          key={mockModal.paymentId}
          paymentId={mockModal.paymentId}
          orderId={data.orderId}
          amount={mockModal.amount || data.totalPrice}
          confirmationUrl={mockModal.confirmationUrl}
          onSuccess={() => {
            setMockModal(null);
            void fetchStatus();
          }}
          onFail={() => {
            setMockModal(null);
            setPayError('Тестовый платёж был отклонён');
            void fetchStatus();
          }}
          onClose={() => setMockModal(null)}
        />
      )}
    </AnimatePresence>
    </>
  );
}
