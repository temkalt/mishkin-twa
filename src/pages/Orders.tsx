import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

interface OrderItem {
  productId: number;
  qty: number;
  price: number; // in kopecks
  name: string;
  image?: string;
}

interface Order {
  id: number;
  totalPrice: number; // already in rubles (server divides /100)
  discount: number;   // already in rubles
  status: string;
  createdAt: string;
  items: OrderItem[];
  userName?: string;
  userPhone?: string;
  userCity?: string;
  userAddress?: string;
  userPostal?: string;
  deliveryMethod?: string;
  comment?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  NEW:       { label: 'Новый',        color: 'text-blue-600',    bg: 'bg-blue-50',    icon: 'schedule' },
  CONFIRMED: { label: 'Подтверждён',  color: 'text-primary',     bg: 'bg-primary/10', icon: 'check_circle' },
  SHIPPED:   { label: 'Отправлен',    color: 'text-amber-600',   bg: 'bg-amber-50',   icon: 'local_shipping' },
  DONE:      { label: 'Доставлен',    color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'inventory' },
  CANCELLED: { label: 'Отменён',      color: 'text-red-500',     bg: 'bg-red-50',     icon: 'cancel' },
};

export function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<Order[]>('/orders')
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-light/80 backdrop-blur-xl px-5 py-5">
        <h1 className="font-display text-xl font-bold text-text-main">Мои заказы</h1>
      </header>

      <div className="flex flex-col gap-3 px-4">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-pastel-ivory/50 p-5">
              <div className="flex justify-between mb-3">
                <div className="h-4 w-24 rounded bg-pastel-sand/60" />
                <div className="h-5 w-20 rounded-full bg-pastel-sand/40" />
              </div>
              <div className="h-3 w-32 rounded bg-pastel-sand/40 mb-2" />
              <div className="h-4 w-20 rounded bg-pastel-sand/50" />
            </div>
          ))
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-6xl text-pastel-sand mb-4">receipt_long</span>
            <h3 className="font-display text-lg font-bold text-text-main mb-2">Заказов пока нет</h3>
            <p className="text-sm text-text-sub mb-6">Выберите свечи в каталоге и оформите первый заказ</p>
            <button
              onClick={() => navigate('/catalog')}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20"
            >
              Перейти в каталог
            </button>
          </div>
        ) : (
          orders.map((order, idx) => {
            const status = STATUS_MAP[order.status] || STATUS_MAP.NEW;
            const date = new Date(order.createdAt);
            const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const isExpanded = expandedId === order.id;

            return (
              <motion.div
                key={order.id}
                className="rounded-2xl bg-white shadow-sm border border-pastel-sand/30 overflow-hidden"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                {/* Card header — clickable to expand */}
                <button
                  className="w-full text-left p-4"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-text-main">Заказ #{order.id}</span>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1 ${status.bg} ${status.color}`}>
                        <span className="material-symbols-outlined text-[12px]">{status.icon}</span>
                        {status.label}
                      </span>
                      <span className="material-symbols-outlined text-text-sub text-[18px] transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Items photo strip */}
                  <div className="flex gap-2 mb-3 overflow-hidden">
                    {order.items.slice(0, 3).map((item, i) => (
                      <div key={item.productId || i} className="size-12 flex-shrink-0 rounded-lg bg-pastel-sand/30 overflow-hidden relative">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-pastel-ivory flex items-center justify-center">
                            <span className="material-symbols-outlined text-text-sub text-[18px]">inventory_2</span>
                          </div>
                        )}
                        {item.qty > 1 && (
                          <span className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] font-bold px-1 rounded-tl">
                            x{item.qty}
                          </span>
                        )}
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-lg bg-pastel-ivory text-xs font-bold text-text-sub">
                        +{order.items.length - 3}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-sub">{dateStr}</span>
                    <span className="text-sm font-bold text-text-main">
                      {order.totalPrice.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border-t border-pastel-sand/30 overflow-hidden"
                    >
                      <div className="p-4 pt-3 flex flex-col gap-3">
                        {/* Items list */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-text-sub mb-2">Состав заказа</p>
                          <div className="flex flex-col gap-2">
                            {order.items.map((item, i) => (
                              <div key={item.productId || i} className="flex items-center gap-3">
                                <div className="size-10 flex-shrink-0 rounded-lg bg-pastel-sand/30 overflow-hidden">
                                  {item.image ? (
                                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full bg-pastel-ivory flex items-center justify-center">
                                      <span className="material-symbols-outlined text-[14px] text-text-sub">inventory_2</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-text-main truncate">{item.name}</p>
                                  <p className="text-[10px] text-text-sub">× {item.qty}</p>
                                </div>
                                <span className="text-xs font-bold text-text-main">
                                  {(item.price * item.qty / 100).toLocaleString('ru-RU')} ₽
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Totals */}
                        <div className="rounded-xl bg-pastel-ivory/50 p-3 flex flex-col gap-1.5">
                          {order.discount > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-text-sub">Скидка (промокод)</span>
                              <span className="text-emerald-600 font-bold">−{order.discount.toLocaleString('ru-RU')} ₽</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-bold">
                            <span className="text-text-main">Итого</span>
                            <span className="text-primary">{order.totalPrice.toLocaleString('ru-RU')} ₽</span>
                          </div>
                        </div>

                        {/* Delivery info */}
                        {(order.userCity || order.userAddress || order.deliveryMethod) && (
                          <div className="flex flex-col gap-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-sub">Доставка</p>
                            {order.deliveryMethod && (
                              <div className="flex items-center gap-2 text-xs text-text-sub">
                                <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                                {order.deliveryMethod}
                              </div>
                            )}
                            {order.userCity && (
                              <div className="flex items-center gap-2 text-xs text-text-sub">
                                <span className="material-symbols-outlined text-[14px]">location_on</span>
                                {order.userCity}{order.userAddress ? `, ${order.userAddress}` : ''}{order.userPostal ? ` (${order.userPostal})` : ''}
                              </div>
                            )}
                            {order.comment && (
                              <div className="flex items-start gap-2 text-xs text-text-sub">
                                <span className="material-symbols-outlined text-[14px] mt-0.5">chat</span>
                                <span className="italic">{order.comment}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
