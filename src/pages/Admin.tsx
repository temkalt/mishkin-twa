import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Icon, type IconName } from '../components/Icon';
import { useShopConfig } from '../store/useShopConfig';
import type { OrderStatus, PaymentStatus, PaymentType } from '../utils/types';

interface OrderItem {
  productId: number;
  qty: number;
  price: number; // в копейках — как сохранено в заказе
  name: string;
  image?: string;
}

interface AdminOrder {
  id: number;
  itemsTotal: number;
  deliveryPrice: number;
  totalPrice: number;
  discount: number;
  status: OrderStatus;
  userName: string;
  userPhone: string;
  userCity: string;
  userAddress: string;
  userPostal: string;
  deliveryMethod: string;
  trackNumber: string;
  comment: string;
  tgUsername: string | null;
  paymentType: PaymentType;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paidAt: string | null;
  createdAt: string;
  items: OrderItem[];
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
  /** Остаток в штуках. null — учёт не ведётся. */
  stock: number | null;
  isFeatured: boolean;
  // API отдаёт уже разобранный массив (в БД лежит JSON-строкой).
  images: string[];
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
// Те же цвета и иконки, что в клиентских «Моих заказах» — один статус
// выглядит одинаково у покупателя и у администратора.
const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-primary/10 text-primary',
  SHIPPED: 'bg-amber-50 text-amber-700',
  DONE: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-danger/10 text-danger',
};
const STATUS_ICONS: Record<string, IconName> = {
  NEW: 'clock',
  CONFIRMED: 'check_circle',
  SHIPPED: 'shipping',
  DONE: 'package_done',
  CANCELLED: 'cancel',
};

const PAYMENT_LABELS: Record<PaymentStatus, { label: string; className: string; icon: IconName }> = {
  UNPAID: { label: 'Не оплачен', className: 'bg-pastel-sand text-text-sub', icon: 'wallet' },
  PENDING: { label: 'Ждёт оплаты', className: 'bg-accent/15 text-accent-deep', icon: 'clock' },
  PAID: { label: 'Оплачен', className: 'bg-emerald-50 text-emerald-700', icon: 'wallet' },
  CANCELED: { label: 'Оплата не прошла', className: 'bg-danger/10 text-danger', icon: 'alert' },
  REFUNDED: { label: 'Возврат', className: 'bg-pastel-sand text-text-sub', icon: 'wallet' },
};

/** Названия способов оплаты, как их присылает ЮKassa. */
const METHOD_LABELS: Record<string, string> = {
  bank_card: 'Карта',
  sbp: 'СБП',
  yoo_money: 'ЮMoney',
  sberbank: 'SberPay',
  tinkoff_bank: 'Т-Банк',
  mock: 'Эмулятор',
};

const money = (value: number) => value.toLocaleString('ru-RU');

type Tab = 'stats' | 'orders' | 'products' | 'promo' | 'broadcast' | 'channel';

export function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('stats');

  const deliveryConfig = useShopConfig((state) => state.delivery);
  const loadShopConfig = useShopConfig((state) => state.load);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  // Трек-номер вводится тут же, где меняется статус: «Отправлен» без трека
  // покупателю ничего не говорит.
  const [trackDrafts, setTrackDrafts] = useState<Record<number, string>>({});

  // Forms state
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoForm, setPromoForm] = useState({ code: '', type: 'PERCENT', value: '', limit: '' });

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ total: number; successCount: number; failCount: number } | null>(null);

  // Channel Post state
  const [channelPostForm, setChannelPostForm] = useState({ text: '', photoUrl: '', buttonText: '🛍 Открыть магазин', startParam: 'channel' });
  const [isChannelPosting, setIsChannelPosting] = useState(false);
  const [channelPostResult, setChannelPostResult] = useState<{ success: boolean; messageId: number; url: string } | null>(null);
  const [channelPostError, setChannelPostError] = useState<string | null>(null);

  const [showProductForm, setShowProductForm] = useState(false);
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState({
    name: '', slug: '', description: '', price: '', category: 'Ароматические',
    topNote: '', heartNote: '', baseNote: '', imageUrls: '', stock: '', inStock: true, isFeatured: false
  });

  // Названия способов доставки берём с сервера — в заказе лежит код (CDEK).
  useEffect(() => {
    void loadShopConfig();
  }, [loadShopConfig]);

  const deliveryLabel = (code: string) =>
    deliveryConfig?.options.find((option) => option.id === code)?.label || code;

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (tab === 'stats') {
        const data = await api.get<Stats>('/users/stats');
        setStats(data);
      } else if (tab === 'orders') {
        const data = await api.get<AdminOrder[]>('/orders');
        setOrders(data);
      } else if (tab === 'products') {
        // Админке нужны и скрытые товары: публичный список отдаёт только inStock.
        const data = await api.get<Product[]>('/products/admin/all');
        setProducts(data);
      } else if (tab === 'promo') {
        const data = await api.get<PromoCode[]>('/promo');
        setPromos(data);
      }
    } catch (err: any) {
      console.error('Admin load error:', err);
      setLoadError(err?.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    const trackNumber = (trackDrafts[orderId] ?? '').trim();
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, {
        status: newStatus,
        ...(trackNumber ? { trackNumber } : {}),
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: newStatus as OrderStatus, trackNumber: trackNumber || o.trackNumber }
            : o,
        )
      );
    } catch (err) {
      console.error('Status update error:', err);
      alert(err instanceof Error ? err.message : 'Не удалось сменить статус');
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

  const handleDeleteProduct = async (id: number) => {
    // Товар не удаляется, а снимается с продажи: заказы с ним должны остаться.
    if (!confirm('Снять товар с продажи? Он исчезнет из каталога, но останется в админке.')) return;
    try {
      await api.delete(`/products/${id}`);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка при снятии товара с продажи');
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    if (!confirm('Вы уверены, что хотите отправить это сообщение всем пользователям бота?')) return;
    
    setIsBroadcasting(true);
    setBroadcastResult(null);
    try {
      const result = await api.post<{total: number, successCount: number, failCount: number}>('/users/broadcast', { message: broadcastMessage });
      setBroadcastResult(result);
      setBroadcastMessage('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка при рассылке');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleChannelPost = async () => {
    if (!channelPostForm.text.trim() && !channelPostForm.photoUrl.trim()) return;
    if (!confirm('Вы уверены, что хотите опубликовать пост в канале?')) return;
    
    setIsChannelPosting(true);
    setChannelPostResult(null);
    setChannelPostError(null);
    try {
      const result = await api.post<{success: boolean; messageId: number; url: string}>('/channel/post', channelPostForm);
      setChannelPostResult(result);
      setChannelPostForm({ text: '', photoUrl: '', buttonText: '🛍 Открыть магазин', startParam: 'channel' });
    } catch (err: any) {
      setChannelPostError(err?.message || 'Ошибка публикации');
    } finally {
      setIsChannelPosting(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Каждая строка — отдельное фото: карточка товара умеет галерею,
      // а сервер принимает до 10 ссылок.
      const images = productForm.imageUrls
        .split('\n')
        .map((url) => url.trim())
        .filter(Boolean);

      // Пустой остаток — учёт по этому товару не ведём (товар всегда доступен).
      const rawStock = productForm.stock.trim();
      const stock = rawStock === '' ? null : Math.max(0, Math.floor(Number(rawStock)));
      if (stock !== null && !Number.isFinite(stock)) {
        alert('Остаток должен быть числом или пустым');
        return;
      }

      const payload = {
        name: productForm.name,
        slug: productForm.slug,
        description: productForm.description,
        price: Number(productForm.price),
        category: productForm.category,
        topNote: productForm.topNote,
        heartNote: productForm.heartNote,
        baseNote: productForm.baseNote,
        images,
        stock,
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
      alert(err instanceof Error ? err.message : 'Ошибка при сохранении товара');
    }
  };

  const openEditProduct = (p: Product) => {
    setProductForm({
      name: p.name, slug: p.slug, description: p.description,
      price: String(p.price), category: p.category,
      topNote: p.topNote, heartNote: p.heartNote, baseNote: p.baseNote,
      imageUrls: (p.images || []).join('\n'),
      stock: p.stock === null || p.stock === undefined ? '' : String(p.stock),
      inStock: p.inStock, isFeatured: p.isFeatured
    });
    setEditProductId(p.id);
    setShowProductForm(true);
  };

  const filteredOrders =
    statusFilter === 'ALL' ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-[calc(2rem+var(--safe-bottom))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <header className="sticky top-0 z-header bg-background-light/80 backdrop-blur-xl px-5 pb-4 pt-[calc(var(--app-top)+1rem)]">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/')}
            className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80 transition-all active:scale-90"
            aria-label="Назад"
          >
            <Icon name="arrow_back" size={20} className="text-text-main" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-text-main">Админ-панель</h1>
            <p className="text-2xs text-text-sub uppercase tracking-wider">Управление магазином</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="h-scroll -mx-5 gap-2 px-5 pb-1.5 pt-1">
          {['stats', 'orders', 'products', 'promo', 'broadcast', 'channel'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as Tab)}
              className={`flex-1 rounded-xl py-2 text-2xs font-bold uppercase tracking-wider transition-all min-w-[70px] ${
                tab === t
                  ? 'bg-primary text-white shadow-md'
                  : 'text-text-sub hover:bg-pastel-sand/50'
              }`}
            >
              {t === 'stats' ? 'Стата' : t === 'orders' ? 'Заказы' : t === 'products' ? 'Товары' : t === 'promo' ? 'Промо' : t === 'broadcast' ? 'Рассылка' : 'Канал'}
            </button>
          ))}
        </div>
      </header>

      {/* ===== STATS TAB ===== */}
      {tab === 'stats' && (
        <div className="px-4 pt-4">
          {loading ? (
            <div className="animate-pulse h-32 bg-white rounded-2xl" />
          ) : loadError ? (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center">
              <Icon name="alert" size={30} className="mx-auto mb-2 text-danger" />
              <p className="text-sm font-bold text-red-600 mb-1">Ошибка загрузки</p>
              <p className="text-xs text-red-500 mb-3">{loadError}</p>
              <button onClick={loadData} className="text-xs font-bold text-primary underline">Повторить</button>
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-pastel-sand/20 flex flex-col items-center text-center">
                <Icon name="group" size={30} className="mb-2 text-primary" />
                <span className="text-3xl font-display font-bold text-text-main">{stats.totalUsers}</span>
                <span className="text-2xs text-text-sub uppercase tracking-wider mt-1">Всего юзеров</span>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-pastel-sand/20 flex flex-col items-center text-center">
                <Icon name="trending_up" size={30} className="mb-2 text-emerald-600" />
                <span className="text-3xl font-display font-bold text-text-main">{stats.activeUsersWeek}</span>
                <span className="text-2xs text-text-sub uppercase tracking-wider mt-1">За неделю</span>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-pastel-sand/20 flex flex-col items-center text-center">
                <Icon name="shopping_bag" size={30} className="mb-2 text-blue-600" />
                <span className="text-3xl font-display font-bold text-text-main">{stats.totalOrders}</span>
                <span className="text-2xs text-text-sub uppercase tracking-wider mt-1">Всего заказов</span>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-pastel-sand/20 flex flex-col items-center text-center">
                <Icon name="notifications" size={30} className="mb-2 text-accent-deep" />
                <span className="text-3xl font-display font-bold text-text-main">{stats.newOrders}</span>
                <span className="text-2xs text-text-sub uppercase tracking-wider mt-1">Новых заказов</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-pastel-ivory p-6 text-center">
              <Icon name="chart" size={36} className="mx-auto mb-2 text-text-sub" />
              <p className="text-sm text-text-sub">Нет данных статистики</p>
            </div>
          )}
        </div>
      )}

      {/* ===== PROMO TAB ===== */}
      {tab === 'promo' && (
        <div className="px-4 pt-4">
          <button
            onClick={() => setShowPromoForm(true)}
            className="w-full mb-4 rounded-xl bg-primary text-white py-3 font-bold text-sm shadow-md flex items-center justify-center gap-2"
          >
            <Icon name="add" size={18} /> Создать промокод
          </button>
          
          {loadError && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3 mb-3 text-center">
              <p className="text-xs text-red-600">{loadError}</p>
              <button onClick={loadData} className="text-xs font-bold text-primary underline mt-1">Повторить</button>
            </div>
          )}
          
          <div className="flex flex-col gap-3">
            {loading ? <div className="animate-pulse h-20 bg-white rounded-2xl" /> : promos.length === 0 ? (
              <div className="rounded-2xl bg-pastel-ivory p-6 text-center">
                <Icon name="percent" size={36} className="mx-auto mb-2 text-text-sub" />
                <p className="text-sm text-text-sub">Промокодов пока нет</p>
              </div>
            ) : promos.map((p) => (
              <div key={p.id} className={`rounded-2xl p-4 shadow-sm border border-pastel-sand/20 ${p.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-display font-bold text-lg text-text-main tracking-wider">{p.code}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${p.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
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
          <div className="h-scroll gap-1.5 py-3">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-2xs font-bold transition-all ${
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
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-2xs font-bold transition-all ${
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
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl bg-pastel-ivory p-6 text-center">
                <Icon name="receipt_long" size={36} className="mx-auto mb-2 text-text-sub" />
                <p className="text-sm text-text-sub">
                  {statusFilter === 'ALL' ? 'Заказов пока нет' : `Нет заказов в статусе «${STATUS_LABELS[statusFilter]}»`}
                </p>
              </div>
            ) : filteredOrders.map((order, idx) => {
                const date = new Date(order.createdAt);
                const payment = PAYMENT_LABELS[order.paymentStatus] || PAYMENT_LABELS.UNPAID;
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
                      <span className={`chip ${STATUS_COLORS[order.status]}`}>
                        <Icon name={STATUS_ICONS[order.status]} size={13} />
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>

                    {/* Оплата: без неё непонятно, можно ли отправлять заказ. */}
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      <span className={`chip ${payment.className}`}>
                        <Icon name={payment.icon} size={13} />
                        {payment.label}
                      </span>
                      <span className="chip bg-pastel-ivory text-text-sub">
                        <Icon name={order.paymentType === 'ONLINE' ? 'card' : 'wallet'} size={13} />
                        {order.paymentType === 'ONLINE' ? 'Онлайн' : 'При получении'}
                      </span>
                      {order.paymentMethod && (
                        <span className="chip bg-pastel-ivory text-text-sub">
                          {METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
                        </span>
                      )}
                      {order.paidAt && (
                        <span className="text-2xs text-text-sub">
                          оплачен {new Date(order.paidAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div className="mb-3 rounded-xl bg-pastel-ivory/50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name="person" size={14} className="text-text-sub" />
                        <span className="text-xs font-medium text-text-main">{order.userName}</span>
                        {order.tgUsername && (
                          <a
                            href={`https://t.me/${order.tgUsername}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary"
                          >
                            @{order.tgUsername}
                          </a>
                        )}
                      </div>
                      {order.userPhone && (
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name="phone" size={14} className="text-text-sub" />
                          <a href={`tel:${order.userPhone.replace(/[^\d+]/g, '')}`} className="text-xs text-text-sub">
                            {order.userPhone}
                          </a>
                        </div>
                      )}
                      {order.userCity && (
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name="location" size={14} className="text-text-sub" />
                          <span className="text-xs text-text-sub">{order.userCity}</span>
                        </div>
                      )}
                      {order.userAddress && (
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name="home" size={14} className="text-text-sub" />
                          <span className="text-xs text-text-sub">{order.userAddress} {order.userPostal && `(${order.userPostal})`}</span>
                        </div>
                      )}
                      {order.deliveryMethod && (
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name="shipping" size={14} className="text-text-sub" />
                          <span className="text-xs text-text-sub">
                            {deliveryLabel(order.deliveryMethod)}
                            {order.trackNumber && ` · трек ${order.trackNumber}`}
                          </span>
                        </div>
                      )}
                      {order.comment && (
                        <div className="flex items-start gap-2 mt-2 pt-2 border-t border-pastel-sand/30">
                          <Icon name="chat" size={14} className="mt-0.5 text-text-sub" />
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

                    <div className="mb-3 flex flex-col gap-1 border-t border-pastel-sand/30 pt-2 text-xs">
                      <div className="flex justify-between text-text-sub">
                        <span>Товары</span>
                        <span>{money(order.itemsTotal)} ₽</span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between text-primary">
                          <span>Скидка</span>
                          <span>−{money(order.discount)} ₽</span>
                        </div>
                      )}
                      <div className="flex justify-between text-text-sub">
                        <span>Доставка</span>
                        <span>{order.deliveryPrice > 0 ? `${money(order.deliveryPrice)} ₽` : 'бесплатно'}</span>
                      </div>
                      <div className="flex justify-between border-t border-pastel-sand/30 pt-1.5 text-sm font-bold text-text-main">
                        <span>Итого</span>
                        <span>{money(order.totalPrice)} ₽</span>
                      </div>
                    </div>

                    {order.status !== 'DONE' && order.status !== 'CANCELLED' && (
                      <div className="flex flex-col gap-2">
                        <input
                          value={trackDrafts[order.id] ?? order.trackNumber ?? ''}
                          onChange={(e) => setTrackDrafts({ ...trackDrafts, [order.id]: e.target.value })}
                          placeholder="Трек-номер (уйдёт клиенту вместе со статусом)"
                          className="w-full rounded-lg border border-line bg-pastel-ivory/50 px-3 py-2 text-xs outline-none focus:border-primary"
                        />
                        <div className="flex gap-1.5 flex-wrap">
                          {STATUSES.filter((s) => s !== order.status).map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(order.id, s)}
                              disabled={updatingId === order.id}
                              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-2xs font-bold transition-all active:scale-95 disabled:opacity-50 ${STATUS_COLORS[s]}`}
                            >
                              <Icon name={STATUS_ICONS[s]} size={13} />
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
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
              setProductForm({ name: '', slug: '', description: '', price: '', category: 'Ароматические', topNote: '', heartNote: '', baseNote: '', imageUrls: '', stock: '', inStock: true, isFeatured: false });
              setShowProductForm(true);
            }}
            className="w-full mb-4 rounded-xl bg-primary text-white py-3 font-bold text-sm shadow-md flex items-center justify-center gap-2"
          >
            <Icon name="add" size={18} /> Добавить товар
          </button>

          <div className="flex flex-col gap-3">
            {loading ? <div className="animate-pulse h-20 bg-white rounded-2xl" /> : products.map((p, idx) => {
              const img = p.images?.[0] || '';
              const tracked = p.stock !== null && p.stock !== undefined;
              const soldOut = p.inStock && tracked && (p.stock as number) <= 0;
              return (
                <motion.div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm border border-pastel-sand/20"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <div className="size-14 flex-shrink-0 rounded-xl bg-pastel-sand/30 overflow-hidden">
                    {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-pastel-ivory" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-text-main truncate">{p.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-sub">{money(p.price)} ₽</span>
                      <span className="text-2xs text-text-sub bg-pastel-ivory px-1.5 rounded">{p.category}</span>
                      {tracked && (
                        <span className={`text-2xs font-bold ${soldOut ? 'text-danger' : 'text-text-sub'}`}>
                          {p.stock} шт.
                        </span>
                      )}
                      {p.images?.length > 1 && (
                        <span className="text-2xs text-text-sub">{p.images.length} фото</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-2xs font-bold ${
                        !p.inStock
                          ? 'bg-danger/10 text-danger'
                          : soldOut
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {!p.inStock ? 'Скрыт' : soldOut ? 'Кончился' : 'В наличии'}
                    </span>
                    <button onClick={() => openEditProduct(p)} className="text-2xs font-bold text-primary uppercase mt-1">Редакт.</button>
                    {p.inStock && (
                      <button onClick={() => handleDeleteProduct(p.id)} className="text-2xs font-bold text-danger uppercase">Скрыть</button>
                    )}
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
          <motion.div className="fixed inset-0 z-sheet flex items-end justify-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(2rem+var(--safe-bottom))]" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-lg font-bold">Новый промокод</h3>
                <button onClick={() => setShowPromoForm(false)} className="text-text-sub" aria-label="Закрыть">
                  <Icon name="close" size={20} />
                </button>
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
          <motion.div className="fixed inset-0 z-sheet flex items-end justify-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-h-[90vh] overflow-y-auto max-w-md rounded-t-3xl bg-white p-5 pb-[calc(2rem+var(--safe-bottom))]" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
              <div className="flex justify-between items-center mb-5 sticky top-0 bg-white z-10 pb-2 border-b border-pastel-sand/20">
                <h3 className="font-display text-lg font-bold">{editProductId ? 'Редактировать товар' : 'Новый товар'}</h3>
                <button type="button" onClick={() => setShowProductForm(false)} className="text-text-sub" aria-label="Закрыть">
                  <Icon name="close" size={20} />
                </button>
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
                  <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Фото — по одной ссылке в строке (до 10)</label>
                  <textarea
                    value={productForm.imageUrls}
                    onChange={e => setProductForm({...productForm, imageUrls: e.target.value})}
                    rows={3}
                    placeholder={'/images/candle_1.jpg\nhttps://…/candle_2.webp'}
                    className="w-full rounded-xl bg-pastel-ivory/50 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="mt-1 text-2xs text-text-sub">Первая — обложка в каталоге, остальные попадут в галерею товара.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Остаток, шт.</label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={productForm.stock}
                    onChange={e => setProductForm({...productForm, stock: e.target.value})}
                    placeholder="не ограничен"
                    className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="mt-1 text-2xs text-text-sub">
                    Списывается при оформлении заказа и возвращается при отмене. Пусто — учёт не ведётся,
                    товар всегда доступен. 0 — покупатель видит «нет в наличии».
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-2xs font-bold text-text-sub uppercase mb-1 block">Верхняя нота</label>
                    <input value={productForm.topNote} onChange={e => setProductForm({...productForm, topNote: e.target.value})} className="w-full rounded-lg bg-pastel-ivory/50 p-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="text-2xs font-bold text-text-sub uppercase mb-1 block">Сердце</label>
                    <input value={productForm.heartNote} onChange={e => setProductForm({...productForm, heartNote: e.target.value})} className="w-full rounded-lg bg-pastel-ivory/50 p-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="text-2xs font-bold text-text-sub uppercase mb-1 block">База</label>
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

      {/* ===== BROADCAST TAB ===== */}
      {tab === 'broadcast' && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-pastel-sand/20">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="megaphone" size={24} className="text-primary" />
              <h3 className="font-display text-lg font-bold text-text-main">Рассылка</h3>
            </div>
            <p className="text-xs text-text-sub mb-4">Сообщение будет отправлено всем пользователям, которые запустили бота. Поддерживается *жирный*, _курсив_.</p>

            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              rows={6}
              placeholder="Введите текст сообщения..."
              className="w-full rounded-xl bg-pastel-ivory/50 p-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none mb-4"
            />

            {broadcastResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4"
              >
                <p className="text-sm font-bold text-emerald-700 mb-1">✅ Рассылка завершена!</p>
                <div className="grid grid-cols-3 gap-2 text-center mt-2">
                  <div>
                    <p className="text-xl font-bold text-text-main">{broadcastResult.total}</p>
                    <p className="text-2xs text-text-sub">Всего</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-600">{broadcastResult.successCount}</p>
                    <p className="text-2xs text-text-sub">Доставлено</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-red-500">{broadcastResult.failCount}</p>
                    <p className="text-2xs text-text-sub">Ошибок</p>
                  </div>
                </div>
              </motion.div>
            )}

            <button
              onClick={handleBroadcast}
              disabled={isBroadcasting || !broadcastMessage.trim()}
              className="w-full rounded-xl bg-primary text-white py-3 font-bold text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBroadcasting ? (
                <>
                  <motion.span
                    className="inline-flex"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Icon name="spinner" size={18} />
                  </motion.span>
                  Отправка...
                </>
              ) : (
                <>
                  <Icon name="send" size={18} />
                  Отправить всем
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===== CHANNEL POST TAB ===== */}
      {tab === 'channel' && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-pastel-sand/20">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="smartphone" size={24} className="text-primary" />
              <h3 className="font-display text-lg font-bold text-text-main">Пост в канал</h3>
            </div>
            <p className="text-xs text-text-sub mb-4">Опубликуйте пост с кнопкой, которая сразу откроет Web App.</p>

            <div className="flex flex-col gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Текст поста</label>
                <textarea
                  value={channelPostForm.text}
                  onChange={(e) => setChannelPostForm({...channelPostForm, text: e.target.value})}
                  rows={4}
                  placeholder="Текст вашего крутого поста..."
                  className="w-full rounded-xl bg-pastel-ivory/50 p-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-sub uppercase mb-1 block">URL фото (опционально)</label>
                <input
                  value={channelPostForm.photoUrl}
                  onChange={(e) => setChannelPostForm({...channelPostForm, photoUrl: e.target.value})}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Текст кнопки</label>
                  <input
                    value={channelPostForm.buttonText}
                    onChange={(e) => setChannelPostForm({...channelPostForm, buttonText: e.target.value})}
                    placeholder="Открыть магазин"
                    className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-sub uppercase mb-1 block">Параметр startapp</label>
                  <input
                    value={channelPostForm.startParam}
                    onChange={(e) => setChannelPostForm({...channelPostForm, startParam: e.target.value})}
                    placeholder="channel"
                    className="w-full rounded-xl bg-pastel-ivory/50 p-3 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {channelPostError && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {channelPostError}
              </div>
            )}

            {channelPostResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4"
              >
                <p className="text-sm font-bold text-emerald-700 mb-2">✅ Пост успешно опубликован!</p>
                <div className="text-xs text-text-main flex flex-col gap-1">
                  <p>ID сообщения: <b>{channelPostResult.messageId}</b></p>
                  <p>Ссылка в кнопке: <a href={channelPostResult.url} target="_blank" rel="noreferrer" className="text-blue-500 break-all">{channelPostResult.url}</a></p>
                </div>
              </motion.div>
            )}

            <button
              onClick={handleChannelPost}
              disabled={isChannelPosting || (!channelPostForm.text.trim() && !channelPostForm.photoUrl.trim())}
              className="w-full rounded-xl bg-primary text-white py-3 font-bold text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChannelPosting ? (
                <>
                  <motion.span
                    className="inline-flex"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Icon name="spinner" size={18} />
                  </motion.span>
                  Публикация...
                </>
              ) : (
                <>
                  <Icon name="send" size={18} />
                  Опубликовать
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
