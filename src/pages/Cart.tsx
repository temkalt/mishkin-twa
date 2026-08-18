import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WebApp } from '../utils/telegram';
import { useCartStore } from '../store/useCartStore';
import { useShopConfig } from '../store/useShopConfig';
import { api } from '../utils/api';
import { haptic } from '../utils/haptics';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Icon } from '../components/Icon';
import { EASE_OUT, spring } from '../utils/motion';
import type { PromoValidateResponse } from '../utils/types';

const money = (value: number) => value.toLocaleString('ru-RU');

export function Cart() {
  const navigate = useNavigate();
  const { items, removeItem, updateQty, getTotal } = useCartStore();
  const { delivery, load } = useShopConfig();
  const total = getTotal();

  const [promoInput, setPromoInput] = useState('');
  const [promoData, setPromoData] = useState<PromoValidateResponse | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

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

  // Telegram MainButton ведёт в чекаут.
  useEffect(() => {
    if (!WebApp.initData) return;

    if (items.length === 0) {
      WebApp.MainButton.hide();
      return;
    }

    WebApp.MainButton.text = `ОФОРМИТЬ — ${money(goodsTotal)} ₽`;
    WebApp.MainButton.color = '#3A5A2A';
    WebApp.MainButton.textColor = '#ffffff';
    WebApp.MainButton.show();

    const handleCheckout = () => {
      haptic.press();
      navigate('/checkout');
    };
    WebApp.onEvent('mainButtonClicked', handleCheckout);

    return () => {
      WebApp.offEvent('mainButtonClicked', handleCheckout);
      WebApp.MainButton.hide();
    };
  }, [items.length, goodsTotal, navigate]);

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
      className="flex min-h-screen flex-col bg-background-light px-4 pb-28 pt-6"
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
              {items.map((item) => (
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
                            className="flex size-7 items-center justify-center text-text-main transition-transform active:scale-90"
                            onClick={() => { haptic.select(); updateQty(item.productId, item.qty + 1); }}
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
              ))}
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

          {/* В браузере Telegram-кнопки нет — показываем свою */}
          {!WebApp.initData && (
            <motion.button
              className="btn-primary mt-5"
              whileTap={{ scale: 0.98 }}
              onClick={() => { haptic.press(); navigate('/checkout'); }}
            >
              <span className="sheen opacity-25" />
              Оформить — {money(goodsTotal)} ₽
            </motion.button>
          )}
        </>
      )}
    </motion.div>
  );
}
