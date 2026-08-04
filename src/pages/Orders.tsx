import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

interface OrderItem {
  id: number;
  qty: number;
  price: number;
  product: {
    name: string;
    images: string;
  };
}

interface Order {
  id: number;
  totalPrice: number;
  discount: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  NEW: { label: 'Новый', color: 'text-blue-600', bg: 'bg-blue-50' },
  CONFIRMED: { label: 'Подтверждён', color: 'text-primary', bg: 'bg-primary/10' },
  SHIPPED: { label: 'Отправлен', color: 'text-amber-600', bg: 'bg-amber-50' },
  DONE: { label: 'Доставлен', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  CANCELLED: { label: 'Отменён', color: 'text-red-500', bg: 'bg-red-50' },
};

export function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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
          // Skeleton
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
            <span className="material-symbols-outlined text-6xl text-pastel-sand mb-4">
              receipt_long
            </span>
            <h3 className="font-display text-lg font-bold text-text-main mb-2">
              Заказов пока нет
            </h3>
            <p className="text-sm text-text-sub mb-6">
              Выберите свечи в каталоге и оформите первый заказ
            </p>
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
            const dateStr = date.toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            return (
              <motion.div
                key={order.id}
                className="rounded-2xl bg-white p-4 shadow-sm border border-pastel-sand/30"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-text-main">Заказ #{order.id}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${status.bg} ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Items preview */}
                <div className="flex gap-2 mb-3 overflow-hidden">
                  {order.items.slice(0, 3).map((item) => {
                    let img = '';
                    try {
                      const imgs = JSON.parse(item.product.images);
                      img = imgs[0] || '';
                    } catch {
                      img = '';
                    }
                    return (
                      <div key={item.id} className="size-12 flex-shrink-0 rounded-lg bg-pastel-sand/30 overflow-hidden">
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-pastel-ivory" />
                        )}
                      </div>
                    );
                  })}
                  {order.items.length > 3 && (
                    <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-lg bg-pastel-ivory text-xs font-bold text-text-sub">
                      +{order.items.length - 3}
                    </div>
                  )}
                </div>

                {/* Bottom row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-sub">{dateStr}</span>
                  <span className="text-sm font-bold text-text-main">
                    {(order.totalPrice / 100).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
