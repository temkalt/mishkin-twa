import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { haptic } from '../utils/haptics';
import { Icon, type IconName } from '../components/Icon';
import { EASE_OUT, fadeUp, staggerContainer } from '../utils/motion';
import type { Order, PaymentStatus } from '../utils/types';

const money = (value: number) => value.toLocaleString('ru-RU');

const STATUS_MAP: Record<string, { label: string; className: string; icon: IconName }> = {
  NEW: { label: 'Новый', className: 'bg-blue-50 text-blue-700', icon: 'clock' },
  CONFIRMED: { label: 'Подтверждён', className: 'bg-primary/10 text-primary', icon: 'check_circle' },
  SHIPPED: { label: 'Отправлен', className: 'bg-amber-50 text-amber-700', icon: 'shipping' },
  DONE: { label: 'Доставлен', className: 'bg-emerald-50 text-emerald-700', icon: 'package_done' },
  CANCELLED: { label: 'Отменён', className: 'bg-danger/10 text-danger', icon: 'cancel' },
};

const PAYMENT_MAP: Record<PaymentStatus, { label: string; className: string; icon: IconName } | null> = {
  UNPAID: null,
  PENDING: { label: 'Ждёт оплаты', className: 'bg-accent/15 text-accent-deep', icon: 'clock' },
  PAID: { label: 'Оплачен', className: 'bg-emerald-50 text-emerald-700', icon: 'wallet' },
  CANCELED: { label: 'Оплата не прошла', className: 'bg-danger/10 text-danger', icon: 'alert' },
  REFUNDED: { label: 'Возврат', className: 'bg-pastel-sand text-text-sub', icon: 'wallet' },
};

function OrderSkeleton() {
  return (
    <div className="card p-4">
      <div className="mb-3 flex justify-between">
        <div className="skeleton h-4 w-24 rounded-lg" />
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
      <div className="mb-3 flex gap-2">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton size-12 rounded-lg" />)}
      </div>
      <div className="skeleton h-4 w-28 rounded-lg" />
    </div>
  );
}

export function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await api.get<Order[]>('/orders'));
    } catch (err) {
      setError((err as Error).message || 'Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-nav-safe"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="glass-nav sticky top-0 z-header px-5 pb-5 pt-[calc(var(--app-top)+1.25rem)]">
        <h1 className="font-display text-xl font-bold text-text-main">Мои заказы</h1>
        {orders.length > 0 && (
          <p className="text-2xs text-text-sub">{orders.length} шт. · нажмите, чтобы раскрыть</p>
        )}
      </header>

      <div className="flex flex-col gap-3 px-4">
        {loading ? (
          [1, 2, 3].map((i) => <OrderSkeleton key={i} />)
        ) : error ? (
          <div className="card p-6 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-danger/10">
              <Icon name="alert" size={22} className="text-danger" />
            </div>
            <h3 className="mb-1 font-display text-base font-bold text-text-main">Не удалось загрузить</h3>
            <p className="mb-4 text-xs text-text-sub">{error}</p>
            <button onClick={() => { haptic.tap(); void load(); }} className="text-xs font-bold text-primary underline">
              Повторить
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-pastel-ivory">
              <Icon name="receipt_long" size={32} className="text-pastel-sand" />
            </div>
            <h3 className="mb-2 font-display text-lg font-bold text-text-main">Заказов пока нет</h3>
            <p className="mb-6 max-w-[260px] text-sm text-text-sub">
              Выберите свечи в каталоге и оформите первый заказ
            </p>
            <button
              onClick={() => { haptic.tap(); navigate('/catalog'); }}
              className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-glow transition-transform active:scale-95"
            >
              Перейти в каталог
            </button>
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-3"
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="visible"
          >
            {orders.map((order) => {
              const status = STATUS_MAP[order.status] || STATUS_MAP.NEW;
              const paymentBadge = PAYMENT_MAP[order.paymentStatus];
              const isExpanded = expandedId === order.id;
              const dateStr = new Date(order.createdAt).toLocaleDateString('ru-RU', {
                day: 'numeric', month: 'long', year: 'numeric',
              });
              const needsPayment =
                order.paymentType === 'ONLINE' &&
                (order.paymentStatus === 'PENDING' || order.paymentStatus === 'CANCELED' || order.paymentStatus === 'UNPAID') &&
                order.status !== 'CANCELLED';

              return (
                <motion.div key={order.id} variants={fadeUp} className="card overflow-hidden">
                  <button
                    className="w-full p-4 text-left"
                    onClick={() => { haptic.select(); setExpandedId(isExpanded ? null : order.id); }}
                    aria-expanded={isExpanded}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-text-main">Заказ #{order.id}</span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {paymentBadge && (
                          <span className={`chip ${paymentBadge.className}`}>
                            <Icon name={paymentBadge.icon} size={12} />
                            {paymentBadge.label}
                          </span>
                        )}
                        <span className={`chip ${status.className}`}>
                          <Icon name={status.icon} size={12} />
                          {status.label}
                        </span>
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-text-sub"
                        >
                          <Icon name="chevron_down" size={17} />
                        </motion.span>
                      </div>
                    </div>

                    <div className="mb-3 flex gap-2 overflow-hidden">
                      {order.items.slice(0, 4).map((item, i) => (
                        <div
                          key={item.productId || i}
                          className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-pastel-sand/30"
                        >
                          {item.image ? (
                            <img src={item.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-pastel-ivory">
                              <Icon name="package" size={17} className="text-text-sub" />
                            </div>
                          )}
                          {item.qty > 1 && (
                            <span className="absolute bottom-0 right-0 rounded-tl bg-black/55 px-1 text-[9px] font-bold text-white">
                              ×{item.qty}
                            </span>
                          )}
                        </div>
                      ))}
                      {order.items.length > 4 && (
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-pastel-ivory text-xs font-bold text-text-sub">
                          +{order.items.length - 4}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-sub">{dateStr}</span>
                      <span className="text-sm font-bold tabular-nums text-text-main">
                        {money(order.totalPrice)} ₽
                      </span>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: EASE_OUT }}
                        className="overflow-hidden border-t border-line/60"
                      >
                        <div className="flex flex-col gap-4 p-4">
                          <div>
                            <p className="field-label">Состав заказа</p>
                            <div className="flex flex-col gap-2">
                              {order.items.map((item, i) => (
                                <div key={item.productId || i} className="flex items-center gap-3">
                                  <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-pastel-sand/30">
                                    {item.image ? (
                                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center bg-pastel-ivory">
                                        <Icon name="package" size={14} className="text-text-sub" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-text-main">{item.name}</p>
                                    <p className="text-2xs text-text-sub">× {item.qty}</p>
                                  </div>
                                  <span className="text-xs font-bold tabular-nums text-text-main">
                                    {money((item.price * item.qty) / 100)} ₽
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 rounded-xl bg-pastel-ivory/60 p-3">
                            <div className="flex justify-between text-xs">
                              <span className="text-text-sub">Товары</span>
                              <span className="tabular-nums text-text-main">{money(order.itemsTotal)} ₽</span>
                            </div>
                            {order.discount > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-text-sub">Скидка</span>
                                <span className="font-bold tabular-nums text-primary">−{money(order.discount)} ₽</span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs">
                              <span className="text-text-sub">Доставка</span>
                              <span className="tabular-nums text-text-main">
                                {order.deliveryPrice === 0 ? 'бесплатно' : `${money(order.deliveryPrice)} ₽`}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-line pt-1.5 text-sm font-bold">
                              <span className="text-text-main">Итого</span>
                              <span className="tabular-nums text-primary">{money(order.totalPrice)} ₽</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <p className="field-label">Доставка</p>
                            {order.deliveryMethod && (
                              <InfoRow icon="shipping" text={order.deliveryMethod} />
                            )}
                            {order.userCity && (
                              <InfoRow
                                icon="location"
                                text={`${order.userCity}${order.userAddress ? `, ${order.userAddress}` : ''}${order.userPostal ? ` (${order.userPostal})` : ''}`}
                              />
                            )}
                            {order.trackNumber && (
                              <InfoRow icon="package" text={`Трек-номер: ${order.trackNumber}`} />
                            )}
                            {order.comment && <InfoRow icon="chat" text={order.comment} italic />}
                          </div>

                          {needsPayment && (
                            <button
                              className="btn-primary"
                              onClick={() => { haptic.press(); navigate(`/order/${order.id}`, { state: { autoPay: true } }); }}
                            >
                              <span className="relative flex items-center justify-center gap-2">
                                <Icon name="card" size={18} /> Оплатить {money(order.totalPrice)} ₽
                              </span>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function InfoRow({ icon, text, italic }: { icon: IconName; text: string; italic?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-xs text-text-sub">
      <span className="mt-0.5 shrink-0">
        <Icon name={icon} size={14} />
      </span>
      <span className={italic ? 'italic' : undefined}>{text}</span>
    </div>
  );
}
