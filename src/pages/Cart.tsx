import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WebApp } from '../utils/telegram';
import { useCartStore } from '../store/useCartStore';
import { api } from '../utils/api';
import { haptic } from '../utils/haptics';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { EASE_OUT } from '../utils/motion';
import type { PromoValidateResponse, OrderResponse } from '../utils/types';

export function Cart() {
  const navigate = useNavigate();
  const { items, removeItem, updateQty, clear, getTotal } = useCartStore();
  const total = getTotal();

  // Promo
  const [promoInput, setPromoInput] = useState('');
  const [promoData, setPromoData] = useState<PromoValidateResponse | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  // Checkout
  const [showCheckout, setShowCheckout] = useState(false);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userCity, setUserCity] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [userPostal, setUserPostal] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('СДЭК');
  const [comment, setComment] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<OrderResponse | null>(null);

  // Calculate discount
  const discount = promoData
    ? promoData.discountType === 'PERCENT'
      ? Math.round(total * (promoData.discountValue / 100))
      : promoData.discountValue
    : 0;
  const finalTotal = Math.max(0, total - discount);

  useEffect(() => {
    if (WebApp.initData) {
      if (items.length > 0 && !showCheckout && !orderSuccess) {
        WebApp.MainButton.text = `ОФОРМИТЬ — ${finalTotal.toLocaleString('ru-RU')} ₽`;
        WebApp.MainButton.color = "#3A5A2A";
        WebApp.MainButton.textColor = "#ffffff";
        WebApp.MainButton.show();
      } else {
        WebApp.MainButton.hide();
      }

      const handleCheckout = () => {
        haptic.press();
        setShowCheckout(true);
        WebApp.MainButton.hide();
      };

      WebApp.onEvent('mainButtonClicked', handleCheckout);
      return () => {
        WebApp.offEvent('mainButtonClicked', handleCheckout);
        WebApp.MainButton.hide();
      };
    }
  }, [items, finalTotal, showCheckout, orderSuccess]);

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

  const handleOrder = async () => {
    if (!userName.trim()) return;
    setIsOrdering(true);
    try {
      const orderItems = items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
      }));

      const result = await api.post<OrderResponse>('/orders', {
        items: orderItems,
        userName: userName.trim(),
        userPhone: userPhone.trim(),
        userCity: userCity.trim(),
        userAddress: userAddress.trim(),
        userPostal: userPostal.trim(),
        deliveryMethod,
        comment: comment.trim(),
        promoCode: promoData?.code,
      });

      setOrderSuccess(result);
      clear();
      haptic.celebrate();
    } catch (err) {
      console.error('Order error:', err);
      haptic.error();
    } finally {
      setIsOrdering(false);
    }
  };

  // --- Order success screen ---
  if (orderSuccess) {
    return (
      <motion.div
        className="mesh-bg flex min-h-screen flex-col items-center justify-center px-6 text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
      >
        <div className="relative mb-6 flex items-center justify-center">
          {/* Radiating celebration rings */}
          {[0, 1, 2].map((i) => (
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
            className="relative flex size-20 items-center justify-center rounded-full bg-primary/10 glow-primary"
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, -8, 0] }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 14 }}
          >
            <span className="material-symbols-outlined text-4xl text-primary">check_circle</span>
          </motion.div>
        </div>
        <motion.h2
          className="mb-2 font-display text-2xl font-bold text-text-main"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          Заказ оформлен!
        </motion.h2>
        <p className="mb-1 text-text-sub">Заказ #{orderSuccess.id}</p>
        <p className="mb-6 text-lg font-bold text-text-main">{orderSuccess.totalPrice.toLocaleString('ru-RU')} ₽</p>
        {orderSuccess.discount > 0 && (
          <p className="mb-4 text-sm text-primary">Скидка: −{orderSuccess.discount.toLocaleString('ru-RU')} ₽</p>
        )}
        <p className="mb-8 text-sm text-text-sub">Наш менеджер свяжется с вами в ближайшее время.</p>
        <motion.button
          onClick={() => { haptic.tap(); navigate('/'); }}
          whileTap={{ scale: 0.96 }}
          className="rounded-xl bg-primary px-8 py-3 font-bold text-white shadow-glow"
        >
          На главную
        </motion.button>
      </motion.div>
    );
  }

  // --- Checkout form ---
  if (showCheckout) {
    return (
      <motion.div
        className="flex min-h-screen flex-col bg-background-light px-4 pb-24 pt-6"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
      >
        <header className="mb-8 flex items-center gap-4">
          <button onClick={() => { haptic.tap(); setShowCheckout(false); }} className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-display text-2xl font-bold text-text-main">Оформление</h1>
        </header>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-sub">Ваше имя *</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Как к вам обращаться?"
              className="w-full rounded-xl border border-pastel-sand bg-white px-4 py-3.5 text-text-main outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-sub">Телефон *</label>
            <input
              type="tel"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              className="w-full rounded-xl border border-pastel-sand bg-white px-4 py-3.5 text-text-main outline-none focus:border-primary transition-colors"
            />
          </div>
          
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-sub">Способ доставки *</label>
            <select
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value)}
              className="w-full rounded-xl border border-pastel-sand bg-white px-4 py-3.5 text-text-main outline-none focus:border-primary transition-colors"
            >
              <option value="СДЭК">СДЭК</option>
              <option value="Почта России">Почта России</option>
              <option value="Boxberry">Boxberry</option>
              <option value="Самовывоз">Самовывоз</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-sub">Город *</label>
            <input
              type="text"
              value={userCity}
              onChange={(e) => setUserCity(e.target.value)}
              placeholder="Город доставки"
              className="w-full rounded-xl border border-pastel-sand bg-white px-4 py-3.5 text-text-main outline-none focus:border-primary transition-colors"
            />
          </div>
          
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-sub">Точный адрес *</label>
            <input
              type="text"
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              placeholder="Улица, дом, квартира / ПВЗ"
              className="w-full rounded-xl border border-pastel-sand bg-white px-4 py-3.5 text-text-main outline-none focus:border-primary transition-colors"
            />
          </div>
          
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-sub">Почтовый индекс</label>
            <input
              type="text"
              value={userPostal}
              onChange={(e) => setUserPostal(e.target.value)}
              placeholder="000000"
              className="w-full rounded-xl border border-pastel-sand bg-white px-4 py-3.5 text-text-main outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-sub">Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Пожелания к заказу..."
              className="w-full rounded-xl border border-pastel-sand bg-white px-4 py-3.5 text-text-main outline-none focus:border-primary transition-colors resize-none min-h-[100px]"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="mt-8 rounded-2xl bg-pastel-ivory/70 p-5">
          <div className="flex justify-between text-sm text-text-sub mb-2">
            <span>Товары ({items.length})</span>
            <span>{total.toLocaleString('ru-RU')} ₽</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-primary mb-2">
              <span>Скидка ({promoData?.code})</span>
              <span>−{discount.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
          <div className="border-t border-pastel-sand pt-2 flex justify-between font-bold text-text-main">
            <span>Итого</span>
            <AnimatedNumber value={finalTotal} suffix=" ₽" />
          </div>
        </div>

        <motion.button
          className="mt-6 w-full rounded-xl bg-primary py-4 font-bold text-white shadow-glow disabled:opacity-50"
          whileTap={{ scale: 0.97 }}
          onClick={() => { haptic.press(); handleOrder(); }}
          disabled={!userName.trim() || !userPhone.trim() || !userCity.trim() || !userAddress.trim() || isOrdering}
        >
          {isOrdering ? 'Оформляем...' : `ЗАКАЗАТЬ — ${finalTotal.toLocaleString('ru-RU')} ₽`}
        </motion.button>
      </motion.div>
    );
  }

  // --- Cart ---
  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light px-4 pb-24 pt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <header className="mb-8 flex items-center gap-4">
        <button onClick={() => { haptic.tap(); navigate(-1); }} className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-display text-2xl font-bold text-text-main">Корзина</h1>
      </header>

      <div className="flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {items.map(item => (
            <motion.div
              key={item.productId}
              layout
              className="relative overflow-hidden rounded-2xl"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, scale: 0.9, marginBottom: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Swipe-to-delete background */}
              <div className="absolute inset-0 flex items-center justify-end rounded-2xl bg-red-500 pr-7">
                <span className="material-symbols-outlined text-white">delete_sweep</span>
              </div>

              {/* Draggable card */}
              <motion.div
                className="relative flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm"
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
                <div className="size-20 shrink-0 rounded-xl bg-pastel-sand/50 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="h-full w-full bg-pastel-ivory" />
                  )}
                </div>
                <div className="flex flex-col flex-1">
                  <h3 className="font-bold text-text-main">{item.name}</h3>
                  <p className="text-sm font-medium text-text-sub">{item.price.toLocaleString('ru-RU')} ₽</p>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 rounded-lg bg-pastel-ivory px-2 py-1">
                      <button
                        className="text-text-sub active:scale-90 transition-transform"
                        onClick={() => { haptic.select(); updateQty(item.productId, item.qty - 1); }}
                      >
                        <span className="material-symbols-outlined text-[16px]">remove</span>
                      </button>
                      <span className="w-5 text-center text-sm font-bold tabular-nums">{item.qty}</span>
                      <button
                        className="text-text-main active:scale-90 transition-transform"
                        onClick={() => { haptic.select(); updateQty(item.productId, item.qty + 1); }}
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>
                    <button
                      onClick={() => { haptic.remove(); removeItem(item.productId); }}
                      className="flex size-8 items-center justify-center rounded-full text-red-500/80 hover:bg-red-50 active:scale-90 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="material-symbols-outlined text-6xl text-pastel-sand mb-4">shopping_bag</span>
            <h3 className="font-display text-xl font-bold text-text-main mb-2">Корзина пуста</h3>
            <p className="text-text-sub mb-6">Добавьте свечи из каталога, чтобы наполнить её светом.</p>
            <button
              onClick={() => { haptic.tap(); navigate('/catalog'); }}
              className="rounded-xl bg-primary px-6 py-3 font-bold text-white shadow-glow"
            >
              Перейти в каталог
            </button>
          </div>
        )}
      </div>

      {/* Promo code */}
      {items.length > 0 && (
        <div className="mt-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="Промокод"
              className="flex-1 rounded-xl border border-pastel-sand bg-white px-4 py-3 text-sm text-text-main uppercase tracking-wider outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={() => { haptic.press(); handlePromoValidate(); }}
              disabled={promoLoading || !promoInput.trim()}
              className="rounded-xl bg-pastel-ivory px-5 py-3 text-sm font-bold text-text-main disabled:opacity-50 transition-transform active:scale-95"
            >
              {promoLoading ? '...' : 'Применить'}
            </button>
          </div>
          {promoError && (
            <motion.p 
              className="mt-2 text-xs text-red-500"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {promoError}
            </motion.p>
          )}
          {promoData && (
            <motion.p 
              className="mt-2 text-xs text-primary font-medium"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              ✓ Промокод {promoData.code} применён: 
              {promoData.discountType === 'PERCENT' 
                ? ` скидка ${promoData.discountValue}%` 
                : ` скидка ${promoData.discountValue.toLocaleString('ru-RU')} ₽`}
            </motion.p>
          )}
        </div>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className="mt-6 rounded-2xl bg-pastel-ivory/70 p-5">
          <div className="flex justify-between text-sm text-text-sub mb-2">
            <span>Товары ({items.reduce((a, i) => a + i.qty, 0)} шт.)</span>
            <AnimatedNumber value={total} suffix=" ₽" />
          </div>
          {discount > 0 && (
            <motion.div
              className="flex justify-between text-sm text-primary mb-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <span>Скидка</span>
              <span>−{discount.toLocaleString('ru-RU')} ₽</span>
            </motion.div>
          )}
          <div className="border-t border-pastel-sand pt-2 flex justify-between font-bold text-text-main text-lg">
            <span>Итого</span>
            <AnimatedNumber value={finalTotal} suffix=" ₽" />
          </div>
        </div>
      )}

      {/* Fallback checkout button for non-Telegram */}
      {items.length > 0 && !WebApp.initData && (
        <motion.button
          className="mt-4 w-full rounded-xl bg-primary py-4 font-bold text-white shadow-glow"
          whileTap={{ scale: 0.97 }}
          onClick={() => { haptic.press(); setShowCheckout(true); }}
        >
          ОФОРМИТЬ — {finalTotal.toLocaleString('ru-RU')} ₽
        </motion.button>
      )}
    </motion.div>
  );
}
