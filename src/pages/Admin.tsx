import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

interface OrderItem {
  id: number;
  qty: number;
  price: number;
  product: { name: string; images: string };
}

interface AdminOrder {
  id: number;
  totalPrice: number;
  discount: number;
  status: string;
  userName: string;
  userPhone: string;
  userCity: string;
  createdAt: string;
  items: OrderItem[];
  user: { telegramId: number; firstName: string; username: string | null };
}

interface Product {
  id: number;
  name: string;
  slug: string;
  price: number;
  category: string;
  inStock: boolean;
  isFeatured: boolean;
  images: string;
}

const STATUSES = ['NEW', 'CONFIRMED', 'SHIPPED', 'DONE', 'CANCELLED'] as const;
const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Подтверждён',
  SHIPPED: 'Отправлен',
  DONE: 'Доставлен',
  CANCELLED: 'Отменён',
};
const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-50 text-blue-600',
  CONFIRMED: 'bg-emerald-50 text-emerald-600',
  SHIPPED: 'bg-amber-50 text-amber-600',
  DONE: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-500',
};

type Tab = 'orders' | 'products' | 'promo';

export function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'orders') {
        const data = await api.get<AdminOrder[]>('/orders');
        setOrders(data);
      } else if (tab === 'products') {
        const data = await api.get<Product[]>('/products');
        setProducts(data);
      }
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      console.error('Status update error:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders =
    statusFilter === 'ALL' ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-light/80 backdrop-blur-xl px-5 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/')}
            className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80 transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-text-main text-[20px]">arrow_back</span>
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-text-main">Админ-панель</h1>
            <p className="text-[10px] text-text-sub uppercase tracking-wider">Управление магазином</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([
            { key: 'orders' as Tab, label: 'Заказы', icon: 'receipt_long' },
            { key: 'products' as Tab, label: 'Товары', icon: 'inventory_2' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                tab === t.key
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-pastel-ivory/80 text-text-sub'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ===== ORDERS TAB ===== */}
      {tab === 'orders' && (
        <div className="px-4">
          {/* Status filter */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-3">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-text-main text-white'
                  : 'bg-pastel-ivory/80 text-text-sub'
              }`}
            >
              Все ({orders.length})
            </button>
            {STATUSES.map((s) => {
              const count = orders.filter((o) => o.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold transition-all ${
                    statusFilter === s ? STATUS_COLORS[s] : 'bg-pastel-ivory/80 text-text-sub'
                  }`}
                >
                  {STATUS_LABELS[s]} ({count})
                </button>
              );
            })}
          </div>

          {/* Orders list */}
          <div className="flex flex-col gap-3">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-white p-4 shadow-sm">
                  <div className="h-4 w-24 rounded bg-pastel-sand/60 mb-3" />
                  <div className="h-3 w-40 rounded bg-pastel-sand/40 mb-2" />
                  <div className="h-3 w-32 rounded bg-pastel-sand/30" />
                </div>
              ))
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-4xl text-pastel-sand mb-2">inbox</span>
                <p className="text-sm text-text-sub">Нет заказов</p>
              </div>
            ) : (
              filteredOrders.map((order, idx) => {
                const date = new Date(order.createdAt);
                return (
                  <motion.div
                    key={order.id}
                    className="rounded-2xl bg-white p-4 shadow-sm border border-pastel-sand/20"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-sm font-bold text-text-main">#{order.id}</span>
                        <span className="ml-2 text-xs text-text-sub">
                          {date.toLocaleDateString('ru-RU')} {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>

                    {/* Customer info */}
                    <div className="mb-3 rounded-xl bg-pastel-ivory/50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[14px] text-text-sub">person</span>
                        <span className="text-xs font-medium text-text-main">{order.userName}</span>
                        {order.user?.username && (
                          <span className="text-xs text-primary">@{order.user.username}</span>
                        )}
                      </div>
                      {order.userPhone && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-text-sub">phone</span>
                          <span className="text-xs text-text-sub">{order.userPhone}</span>
                        </div>
                      )}
                      {order.userCity && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[14px] text-text-sub">location_on</span>
                          <span className="text-xs text-text-sub">{order.userCity}</span>
                        </div>
                      )}
                    </div>

                    {/* Items */}
                    <div className="mb-3 flex flex-col gap-1.5">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-text-main">{item.product.name} × {item.qty}</span>
                          <span className="font-medium text-text-sub">{(item.price / 100).toLocaleString('ru-RU')} ₽</span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between border-t border-pastel-sand/30 pt-2 mb-3">
                      {order.discount > 0 && (
                        <span className="text-xs text-primary">Скидка: −{(order.discount / 100).toLocaleString('ru-RU')} ₽</span>
                      )}
                      <span className="ml-auto text-sm font-bold text-text-main">
                        {(order.totalPrice / 100).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>

                    {/* Status change buttons */}
                    {order.status !== 'DONE' && order.status !== 'CANCELLED' && (
                      <div className="flex gap-1.5 flex-wrap">
                        {STATUSES.filter((s) => s !== order.status).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(order.id, s)}
                            disabled={updatingId === order.id}
                            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 ${STATUS_COLORS[s]}`}
                          >
                            → {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===== PRODUCTS TAB ===== */}
      {tab === 'products' && (
        <div className="px-4">
          <div className="flex flex-col gap-3 py-3">
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                  <div className="size-14 rounded-xl bg-pastel-sand/40" />
                  <div className="flex-1">
                    <div className="h-4 w-24 rounded bg-pastel-sand/60 mb-1" />
                    <div className="h-3 w-16 rounded bg-pastel-sand/40" />
                  </div>
                </div>
              ))
            ) : (
              products.map((p, idx) => {
                let img = '';
                try {
                  const imgs = JSON.parse(p.images);
                  img = imgs[0] || '';
                } catch { img = ''; }
                return (
                  <motion.div
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm border border-pastel-sand/20"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <div className="size-14 flex-shrink-0 rounded-xl bg-pastel-sand/30 overflow-hidden">
                      {img ? (
                        <img src={img} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-pastel-ivory" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-text-main truncate">{p.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text-sub">
                          {(p.price / 100).toLocaleString('ru-RU')} ₽
                        </span>
                        <span className="text-[9px] text-text-sub">·</span>
                        <span className="text-[10px] text-text-sub">{p.category}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {p.isFeatured && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                          Featured
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${p.inStock ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {p.inStock ? 'В наличии' : 'Нет'}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
