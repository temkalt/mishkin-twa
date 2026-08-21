import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WebApp } from '../utils/telegram';
import { useCartStore } from '../store/useCartStore';
import { useProductStore } from '../store/useProductStore';
import { useShopConfig } from '../store/useShopConfig';
import { api } from '../utils/api';
import { haptic } from '../utils/haptics';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Icon } from '../components/Icon';
import { isAvailable, maxQty, MAX_QTY } from '../utils/stock';
import { EASE_OUT, spring } from '../utils/motion';
import type { PromoValidateResponse } from '../utils/types';

const money = (value: number) => value.toLocaleString('ru-RU');

export function Cart() {
  const navigate = useNavigate();
  // Подписываемся по полям, а не деструктуризацией всего стора: без селектора
  // Zustand дёргает рендер на любой set(), включая служебные loadedAt/featured,
  // которых этой странице не видно.
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const getTotal = useCartStore((s) => s.getTotal);
  const delivery = useShopConfig((s) => s.delivery);
  const load = useShopConfig((s) => s.load);
  // Каталог нужен корзине только ради остатков: показать «в наличии N шт.» и не
  // дать уйти в чекаут с количеством, которое сервер отклонит.
  const products = useProductStore((s) => s.products);
  const fetchProducts = useProductStore((s) => s.fetchProducts);
  const total = getTotal();

  const [promoInput, setPromoInput] = useState('');
  const [promoData, setPromoData] = useState<PromoValidateResponse | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    void load();
    void fetchProducts();
  }, [load, fetchProducts]);

  /** Остаток по позиции корзины: null — учёт не ведётся или товар неизвестен. */
  const limitFor = (productId: number): { limit: number; left: number | null; gone: boolean } => {
    const product = products.find((p) => p.id === productId);
    if (!product) return { limit: MAX_QTY, left: null, gone: false };
    return {
      limit: maxQty(product),
      left: product.stock ?? null,
      gone: !isAvailable(product),
    };
  };

  // Оформлять нечего, если товара нет или в корзине больше, чем на складе.
  const blocked = items.some((item) => {
    const { limit, gone } = limitFor(item.productId);
    return gone || item.qty > limit;
  });

  const discount = promoData
    ? promoData.discountType === 'PERCENT'
      ? Math.round(total * (promoData.discountValue / 100))
      : Math.min(promoData.discountValue, total)
    : 0;
  const goodsTotal = Math.max(0, total - discount);

  // Промокод переживает переход в чекаут — он читает его из sessionStorage.
  useEffect(() => {
    if (promoData) sessionStorage.setItem('mishkin_promo', JSON.stringify(promoData));
    else sessionStorage.removeItem('mishkin_promo');
  }, [promoData]);

  useEffect(() => {
    const saved = sessionStorage.getItem('mishkin_promo');
    if (saved) {
      try {
        setPromoData(JSON.parse(saved));
      } catch {
        sessionStorage.removeItem('mishkin_promo');
      }
    }
  }, []);

  // Кнопку «Оформить» рисуем сами, а нативную MainButton прячем.
  //
  // Раньше корзина показывала MainButton, и на iPhone получалось два футера
  // сразу: нативная кнопка Telegram снизу и стеклянный таб-бар над ней, у
  // самой полоски home indicator. Своя панель ещё и умеет то, чего MainButton
  // не умеет: гасится, пока в корзине товар не в наличии.
  useEffect(() => {
    if (WebApp.initData) WebApp.MainButton.hide();
  }, []);

  const handlePromoValidate = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoData(null);
    try {
      const result = await api.post<PromoValidateResponse>('/promo/validate', { code: promoInput.trim() });
      setPromoData(result);
      haptic.success();
    } catch (err) {
      setPromoError((err as Error).message || 'Промокод не найден');
      haptic.error();
    } finally {
      setPromoLoading(false);
    }
  };

  const freeFrom = delivery?.freeFrom ?? 0;
  const toFreeDelivery = freeFrom > 0 ? Math.max(0, freeFrom - goodsTotal) : 0;

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light px-4 pb-nav-safe pt-[calc(var(--app-top)+1.5rem)]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={spring.soft}
    >
      <header className="mb-7 flex items-center gap-4">
        <button
          onClick={() => { haptic.tap(); navigate(-1); }}
          aria-label="Назад"
          className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90"
        >
          <Icon name="arrow_back" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main">Корзина</h1>
          {items.length > 0 && (
            <p className="text-2xs text-text-sub">
              {items.reduce((acc, i) => acc + i.qty, 0)} шт. · свайп влево, чтобы удалить
            </p>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <motion.div
          className="flex flex-1 flex-col items-center justify-center py-10 text-center"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-pastel-ivory">
            <Icon name="shopping_bag" size={34} className="text-pastel-sand" />
          </div>
          <h3 className="mb-2 font-display text-xl font-bold text-text-main">Корзина пуста</h3>
          <p className="mb-7 max-w-[260px] text-sm leading-relaxed text-text-sub">
            Добавьте свечи из каталога, чтобы наполнить её светом.
          </p>
          <button
            onClick={() => { haptic.tap(); navigate('/catalog'); }}
            className="rounded-2xl bg-primary px-7 py-3.5 font-bold text-white shadow-glow transition-transform active:scale-95"
          >
            Перейти в каталог
          </button>
        </motion.div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const { limit, left, gone } = limitFor(item.productId);
                const overLimit = item.qty > limit;
                return (
                <motion.div
                  key={item.productId}
                  layout
                  className="relative overflow-hidden rounded-2xl"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, scale: 0.94, marginBottom: -12 }}
                  transition={{ duration: 0.28, ease: EASE_OUT }}
                >
                  <div className="absolute inset-0 flex items-center justify-end rounded-2xl bg-danger pr-7">
                    <Icon name="delete" className="text-white" />
                  </div>

                  <motion.div
                    className="relative flex items-center gap-4 rounded-2xl border border-line/60 bg-surface p-3.5 shadow-soft"
                    drag="x"
                    dragConstraints={{ left: -96, right: 0 }}
                    dragElastic={0.12}
                    dragMomentum={false}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -80) {
                        haptic.remove();
                        removeItem(item.productId);
                      }
                    }}
                  >
                    <button
                      onClick={() => { haptic.tap(); navigate(`/product/${item.productId}`); }}
                      className="size-[76px] shrink-0 overflow-hidden rounded-xl bg-pastel-sand/50"
                      aria-label={item.name}
                    >
                      {item.image ? (
                        <img src={item.image} alt="" className="h-full w-full object-cover" draggable={false} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-pastel-ivory">
                          <Icon name="package" className="text-text-sub" />
                        </div>
                      )}
                    </button>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="truncate font-bold text-text-main">{item.name}</h3>
                      <p className="text-sm font-medium text-text-sub">{money(item.price)} ₽</p>

                      {gone ? (
                        <p className="mt-1 flex items-center gap-1 text-2xs font-semibold text-danger">
                          <Icon name="alert" size={12} /> Нет в наличии — удалите из корзины
                        </p>
                      ) : overLimit ? (
                        <button
                          onClick={() => { haptic.select(); updateQty(item.productId, limit); }}
                          className="mt-1 flex items-center gap-1 text-left text-2xs font-semibold text-danger"
                        >
                          <Icon name="alert" size={12} /> В наличии {left} шт. — оставить {limit}
                        </button>
                      ) : left !== null && left - item.qty <= 2 ? (
                        <p className="mt-1 text-2xs font-semibold text-accent-deep">
                          Осталось {left} шт.
                        </p>
                      ) : null}

                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 rounded-xl bg-pastel-ivory px-2 py-1">
                          <button
                            aria-label="Уменьшить количество"
                            className="flex size-7 items-center justify-center text-text-sub transition-transform active:scale-90"
                            onClick={() => { haptic.select(); updateQty(item.productId, item.qty - 1); }}
                          >
                            <Icon name="remove" size={16} />
                          </button>
                          <span className="w-5 text-center text-sm font-bold tabular-nums">{item.qty}</span>
                          <button
                            aria-label="Увеличить количество"
                            disabled={item.qty >= limit}
                            className="flex size-7 items-center justify-center text-text-main transition-transform active:scale-90 disabled:opacity-30"
                            onClick={() => { haptic.select(); updateQty(item.productId, Math.min(limit, item.qty + 1)); }}
                          >
                            <Icon name="add" size={16} />
                          </button>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-text-main">
                          {money(item.price * item.qty)} ₽
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Прогресс до бесплатной доставки — мягкий стимул добрать корзину */}
          {freeFrom > 0 && (
            <div className="mt-5 rounded-2xl border border-line/60 bg-pastel-ivory/60 p-4">
              {toFreeDelivery > 0 ? (
                <>
                  <p className="mb-2 text-xs text-text-sub">
                    До бесплатной доставки{' '}
                    <b className="text-text-main">{money(toFreeDelivery)} ₽</b>
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-pastel-sand">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (goodsTotal / freeFrom) * 100)}%` }}
                      transition={{ duration: 0.6, ease: EASE_OUT }}
                    />
                  </div>
                </>
              ) : (
                <p className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Icon name="check_circle" size={16} />
                  Доставка бесплатно
                </p>
              )}
            </div>
          )}

          {/* Промокод */}
          <div className="mt-5">
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Промокод"
                aria-label="Промокод"
                className="field flex-1 uppercase tracking-wider"
              />
              <button
                onClick={() => { haptic.press(); void handlePromoValidate(); }}
                disabled={promoLoading || !promoInput.trim()}
                className="rounded-xl bg-pastel-ivory px-5 text-sm font-bold text-text-main transition-transform active:scale-95 disabled:opacity-50"
              >
                {promoLoading ? <Icon name="spinner" size={18} className="animate-spin-slow" /> : 'Применить'}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {promoError && (
                <motion.p
                  key="err"
                  className="mt-2 flex items-center gap-1.5 text-xs text-danger"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Icon name="alert" size={14} /> {promoError}
                </motion.p>
              )}
              {promoData && (
                <motion.p
                  key="ok"
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Icon name="check_circle" size={14} />
                  {promoData.code} —{' '}
                  {promoData.discountType === 'PERCENT'
                    ? `скидка ${promoData.discountValue}%`
                    : `скидка ${money(promoData.discountValue)} ₽`}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Итог */}
          <div className="mt-5 rounded-2xl bg-pastel-ivory/70 p-5">
            <div className="mb-2 flex justify-between text-sm text-text-sub">
              <span>Товары</span>
              <AnimatedNumber value={total} suffix=" ₽" className="tabular-nums" />
            </div>
            {discount > 0 && (
              <motion.div
                className="mb-2 flex justify-between text-sm text-primary"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <span>Скидка</span>
                <span className="tabular-nums">−{money(discount)} ₽</span>
              </motion.div>
            )}
            <div className="mb-3 flex justify-between text-sm text-text-sub">
              <span>Доставка</span>
              <span>{toFreeDelivery > 0 ? 'на следующем шаге' : 'бесплатно'}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-bold text-text-main">
              <span>Итого</span>
              <AnimatedNumber value={goodsTotal} suffix=" ₽" className="tabular-nums" />
            </div>
          </div>

          {/* Пока в корзине недоступный товар — в чекаут не пускаем */}
          {blocked && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-danger/10 p-3 text-2xs text-danger">
              <Icon name="alert" size={14} className="mt-px shrink-0" />
              Поправьте количество или уберите товар, которого нет в наличии.
            </p>
          )}
        </>
      )}

      {/* Кнопка оформления заказа */}
      {items.length > 0 && (
        <motion.div
          className="mt-5 pb-6"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.soft}
        >
          <motion.button
            className="btn-primary w-full py-4 text-base shadow-glow font-bold"
            whileTap={{ scale: 0.98 }}
            disabled={blocked}
            onClick={() => { haptic.press(); navigate('/checkout'); }}
          >
            {!blocked && <span className="sheen opacity-25" />}
            <span className="relative">Оформить заказ — {money(goodsTotal)} ₽</span>
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
