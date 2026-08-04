import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

interface OrderItem {
  productId: number;
  qty: number;
  price: number;
  name: string;
  image?: string;
}

interface AdminOrder {
  id: number;
  totalPrice: number;
  discount: number;
  status: string;
  userName: string;
  userPhone: string;
  userCity: string;
  userAddress: string;
  userPostal: string;
  deliveryMethod: string;
  comment: string;
  tgUsername: string | null;
  createdAt: string;
  items: OrderItem[];
  user: { telegramId: number; firstName: string; username: string | null };
}

interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  topNote: string;
  heartNote: string;
  baseNote: string;
  inStock: boolean;
  isFeatured: boolean;
  images: string;
}

interface Stats {
  totalUsers: number;
  activeUsersWeek: number;
  totalOrders: number;
  newOrders: number;
}

interface PromoCode {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  isActive: boolean;
  usageLimit: number;
  usageCount: number;
  createdAt: string;
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

type Tab = 'stats' | 'orders' | 'products' | 'promo';

export function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('stats');
  
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Forms state
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoForm, setPromoForm] = useState({ code: '', type: 'PERCENT', value: '', limit: '' });

  const [showProductForm, setShowProductForm] = useState(false);
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState({
    name: '', slug: '', description: '', price: '', category: 'Ароматические',
    topNote: '', heartNote: '', baseNote: '', imageUrl: '', inStock: true, isFeatured: false
  });

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'stats') {
        const data = await api.get<Stats>('/users/stats');
        setStats(data);
      } else if (tab === 'orders') {
        const data = await api.get<AdminOrder[]>('/orders');
        setOrders(data);
      } else if (tab === 'products') {
        const data = await api.get<Product[]>('/products');
        setProducts(data);
      } else if (tab === 'promo') {
        const data = await api.get<PromoCode[]>('/promo');
        setPromos(data);
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

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/promo', {
        code: promoForm.code,
        discountType: promoForm.type,
        discountValue: Number(promoForm.value),
        usageLimit: Number(promoForm.limit) || 0
      });
      setShowPromoForm(false);
      setPromoForm({ code: '', type: 'PERCENT', value: '', limit: '' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Ошибка при создании промокода');
    }
  };

  const handleDeletePromo = async (id: number) => {
    if (!confirm('Отключить этот промокод?')) return;
    try {
      await api.delete(`/promo/${id}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: productForm.name,
        slug: productForm.slug,
        description: productForm.description,
        price: Number(productForm.price),
        category: productForm.category,
        topNote: productForm.topNote,
        heartNote: productForm.heartNote,
        baseNote: productForm.baseNote,
        images: productForm.imageUrl ? [productForm.imageUrl] : [],
        inStock: productForm.inStock,
        isFeatured: productForm.isFeatured
      };

      if (editProductId) {
        await api.put(`/products/${editProductId}`, payload);
      } else {
        await api.post('/products', payload);
      }
      
      setShowProductForm(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении товара');
    }
  };

  const openEditProduct = (p: Product) => {
    let img = '';
    try { img = JSON.parse(p.images)[0] || ''; } catch { /* ignore */ }
    setProductForm({
      name: p.name, slug: p.slug, description: p.description,
      price: String(p.price), category: p.category,
      topNote: p.topNote, heartNote: p.heartNote, baseNote: p.baseNote,
      imageUrl: img, inStock: p.inStock, isFeatured: p.isFeatured
    });
    setEditProductId(p.id);
    setShowProductForm(true);
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
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {([
            { key: 'stats' as Tab, label: 'Стат.', icon: 'monitoring' },
            { key: 'orders' as Tab, label: 'Заказы', icon: 'receipt_long' },
            { key: 'products' as Tab, label: 'Товары', icon: 'inventory_2' },
            { key: 'promo' as Tab, label: 'Промо', icon: 'percent' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all shrink-0 ${
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

      {/* ===== STATS TAB ===== */}
      {tab === 'stats' && (
        <div className="px-4 pt-4">
          {loading ? (
            <div className="animate-pulse h-32 bg-white rounded-2xl" />
          ) : stats ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-pastel-sand/20 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-3xl text-primary mb-2">group</span>
                <span className="text-3xl font-display font-bold text-text-main">{stats.totalUsers}</span>
                <span className="text-[10px] text-text-sub uppercase tracking-wider mt-1">Всего юзеров</span>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-pastel-sand/20 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-3xl text-emerald-500 mb-2">trending_up</span>
                <span className="text-3xl font-display font-bold text-text-main">{stats.activeUsersWeek}</span>
                <span className="text-[10px] text-text-sub uppercase tracking-wider mt-1">За неделю</span>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-pastel-sand/20 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-3xl text-blue-500 mb-2">shopping_bag</span>
                <span className="text-3xl font-display font-bold text-text-main">{stats.totalOrders}</span>
                <span className="text-[10px] text-text-sub uppercase tracking-wider mt-1">Всего заказов</span>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-pastel-sand/20 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-3xl text-amber-500 mb-2">notifications_active</span>
                <span className="text-3xl font-display font-bold text-text-main">{stats.newOrders}</span>
                <span className="text-[10px] text-text-sub uppercase tracking-wider mt-1">Новых заказов</span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ===== PROMO TAB ===== */}
      {tab === 'promo' && (
        <div className="px-4 pt-4">
          <button
            onClick={() => setShowPromoForm(true)}
            className="w-full mb-4 rounded-xl bg-primary text-white py-3 font-bold text-sm shadow-md flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> Создать промокод
          </button>
          
          <div className="flex flex-col gap-3">
            {loading ? <div className="animate-pulse h-20 bg-white rounded-2xl" /> : promos.map((p) => (
              <div key={p.id} className={`rounded-2xl p-4 shadow-sm border border-pastel-sand/20 ${p.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-display font-bold text-lg text-text-main tracking-wider">{p.code}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                    {p.isActive ? 'Активен' : 'Отключен'}
                  </span>
                </div>
                <div className="flex justify-between items-end text-sm text-text-sub">
                  <div>
                    <p>Скидка: <span className="font-bold text-primary">{p.discountType === 'PERCENT' ? `${p.discountValue}%` : `${p.discountValue.toLocaleString('ru-RU')} ₽`}</span></p>
                    <p className="text-xs">Использовано: {p.usageCount} {p.usageLimit > 0 ? `/ ${p.usageLimit}` : '(безлимит)'}</p>
                  </div>
                  {p.isActive && (
                    <button onClick={() => handleDeletePromo(p.id)} className="text-red-500 font-bold text-xs uppercase tracking-wider p-2">
                      Отключить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== ORDERS TAB ===== */}
      {tab === 'orders' && (
        <div className="px-4">
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

          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="animate-pulse h-32 bg-white rounded-2xl" />
            ) : filteredOrders.map((order, idx) => {
                const date = new Date(order.createdAt);
                return (
                  <motion.div
                    key={order.id}
                    className="rounded-2xl bg-white p-4 shadow-sm border border-pastel-sand/20"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
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

                    <div className="mb-3 rounded-xl bg-pastel-ivory/50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[14px] text-text-sub">person</span>
                        <span className="text-xs font-medium text-text-main">{order.userName}</span>
                        {(order.tgUsername || order.user?.username) && (
                          <span className="text-xs text-primary">@{order.tgUsername || order.user?.username}</span>
                        )}
                      </div>
                      {order.userPhone && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-text-sub">phone</span>
                          <span className="text-xs text-text-sub">{order.userPhone}</span>
                        </div>
                      )}
                      {order.userCity && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-text-sub">location_on</span>
                          <span className="text-xs text-text-sub">{order.userCity}</span>
                        </div>
                      )}
                      {order.userAddress && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-text-sub">home</span>
                          <span className="text-xs text-text-sub">{order.userAddress} {order.userPostal && `(${order.userPostal})`}</span>
                        </div>
                      )}
                      {order.deliveryMethod && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-text-sub">local_shipping</span>
                          <span className="text-xs text-text-sub">{order.deliveryMethod}</span>
                        </div>
                      )}
                      {order.comment && (
                        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-pastel-sand/30">
                          <span className="material-symbols-outlined text-[14px] text-text-sub mt-0.5">chat</span>
                          <span className="text-xs text-text-sub italic">{order.comment}</span>
                        </div>
                      )}
                    </div>

                    <div className="mb-3 flex flex-col gap-1.5">
                      {order.items.map((item, i) => (
                        <div key={item.productId || i} className="flex items-center justify-between text-xs">
                          <span className="text-text-main">{item.name} × {item.qty}</span>
                          <span className="font-medium text-text-sub">{(item.price / 100).toLocaleString('ru-RU')} ₽</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-pastel-sand/30 pt-2 mb-3">
                      {order.discount > 0 && (
                        <span className="text-xs text-primary">Скидка: −{(order.discount / 100).toLocaleString('ru-RU')} ₽</span>
                      )}
                      <span className="ml-auto text-sm font-bold text-text-main">
                        {(order.totalPrice / 100).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>

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
              })}
          </div>
        </div>
      )}

      {/* ===== PRODUCTS TAB ===== */}
      {tab === 'products' && (
        <div className="px-4 pt-4">
          <button
            onClick={() => {
              setEditProductId(null);
              setProductForm({ name: '', slug: '', description: '', price: '', category: 'Ароматические', topNote: '', heartNote: '', baseNote: '', imageUrl: '', inStock: true, isFeatured: false });
              setShowProductForm(true);
            }}
            className="w-full mb-4 rounded-xl bg-primary text-white py-3 font-bold text-sm shadow-md flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> Добавить товар
          </button>

          <div className="flex flex-col gap-3">
            {loading ? <div className="animate-pulse h-20 bg-white rounded-2xl" /> : products.map((p, idx) => {
              let img = '';
              try { img = JSON.parse(p.images)[0] || ''; } catch { /* ignore */ }
              return (
                <motion.div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm border border-pastel-sand/20"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <div className="size-14 flex-shrink-0 rounded-xl bg-pastel-sand/30 overflow-hidden">
                    {img ? <img src={img} alt={p.name} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-pastel-ivory" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-text-main truncate">{p.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-sub">{(p.price).toLocaleString('ru-RU')} ₽</span>
                      <span className="text-[10px] text-text-sub bg-pastel-ivory px-1.5 rounded">{p.category}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${p.inStock ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {p.inStock ? 'В наличии' : 'Нет'}
                    </span>
                    <button onClick={() => openEditProduct(p)} className="text-[10px] font-bold text-primary uppercase mt-1">Редакт.</button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Forms Modals */}
      <AnimatePresence>
        {showPromoForm && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-lg font-bold">Новый промокод</h3>
                <button onClick={() => setShowPromoForm(false)} className="material-symbols-outlined text-text-sub">close</button>
              </div>
              <form onSubmit={handleCreatePromo} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Код</label>
                  <input required value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})} placeholder="Например, SALE20" className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Тип скидки</label>
                    <select value={promoForm.type} onChange={e => setPromoForm({...promoForm, type: e.target.value})} className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="PERCENT">Процент (%)</option>
                      <option value="FIXED">Рубли (₽)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Значение</label>
                    <input required type="number" value={promoForm.value} onChange={e => setPromoForm({...promoForm, value: e.target.value})} placeholder={promoForm.type === 'PERCENT' ? '10' : '500'} className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Лимит использований (0 = безлимит)</label>
                  <input type="number" value={promoForm.limit} onChange={e => setPromoForm({...promoForm, limit: e.target.value})} placeholder="0" className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <button type="submit" className="w-full mt-2 rounded-xl bg-primary text-white py-3 font-bold shadow-md">Создать</button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showProductForm && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-h-[90vh] overflow-y-auto max-w-md rounded-t-3xl bg-white p-5 pb-8" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
              <div className="flex justify-between items-center mb-5 sticky top-0 bg-white z-10 pb-2 border-b border-pastel-sand/20">
                <h3 className="font-display text-lg font-bold">{editProductId ? 'Редактировать товар' : 'Новый товар'}</h3>
                <button type="button" onClick={() => setShowProductForm(false)} className="material-symbols-outlined text-text-sub">close</button>
              </div>
              <form onSubmit={handleSaveProduct} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Название</label>
                  <input required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})} className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Цена (₽)</label>
                    <input required type="number" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Категория</label>
                    <input required value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Описание</label>
                  <textarea required value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} rows={3} className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-sub uppercase mb-1 block">URL фото (например, /images/candle_1.jpg)</label>
                  <input value={productForm.imageUrl} onChange={e => setProductForm({...productForm, imageUrl: e.target.value})} className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-text-sub uppercase mb-1 block">Верхняя нота</label>
                    <input value={productForm.topNote} onChange={e => setProductForm({...productForm, topNote: e.target.value})} className="w-full rounded-lg bg-pastel-ivory/50 p-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-sub uppercase mb-1 block">Сердце</label>
                    <input value={productForm.heartNote} onChange={e => setProductForm({...productForm, heartNote: e.target.value})} className="w-full rounded-lg bg-pastel-ivory/50 p-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-sub uppercase mb-1 block">База</label>
                    <input value={productForm.baseNote} onChange={e => setProductForm({...productForm, baseNote: e.target.value})} className="w-full rounded-lg bg-pastel-ivory/50 p-2 text-xs outline-none" />
                  </div>
                </div>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={productForm.inStock} onChange={e => setProductForm({...productForm, inStock: e.target.checked})} className="rounded text-primary focus:ring-primary" />
                    <span className="text-sm font-medium">В наличии</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={productForm.isFeatured} onChange={e => setProductForm({...productForm, isFeatured: e.target.checked})} className="rounded text-primary focus:ring-primary" />
                    <span className="text-sm font-medium">Хит продаж</span>
                  </label>
                </div>
                <button type="submit" className="w-full mt-4 rounded-xl bg-primary text-white py-3 font-bold shadow-md">Сохранить</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
