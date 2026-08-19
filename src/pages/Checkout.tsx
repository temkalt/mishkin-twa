import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WebApp } from '../utils/telegram';
import { useCartStore } from '../store/useCartStore';
import { useShopConfig } from '../store/useShopConfig';
import { api } from '../utils/api';
import { haptic } from '../utils/haptics';
import { Icon, type IconName } from '../components/Icon';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { EASE_OUT, spring, staggerContainer, fadeUp } from '../utils/motion';
import { formatPhone, isValidPhone, isValidPostal, phoneToE164 } from '../utils/phone';
import type {
  OrderResponse,
  PaymentType,
  PromoValidateResponse,
} from '../utils/types';

const money = (value: number) => value.toLocaleString('ru-RU');

interface FormState {
  name: string;
  phone: string;
  city: string;
  address: string;
  postal: string;
  comment: string;
}

export function Checkout() {
  const navigate = useNavigate();
  const { items, getTotal, clear } = useCartStore();
  const { delivery, payment, load, isLoading } = useShopConfig();
  const orderSubmittedRef = useRef(false);

  const [form, setForm] = useState<FormState>({
    name: '', phone: '', city: '', address: '', postal: '', comment: '',
  });
  const [deliveryId, setDeliveryId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('ONLINE');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'consent', string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [promo, setPromo] = useState<PromoValidateResponse | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Пустую корзину оформлять нечего (не перенаправляем, если заказ только что отправлен)
  useEffect(() => {
    if (!orderSubmittedRef.current && items.length === 0) {
      navigate('/cart', { replace: true });
    }
  }, [items.length, navigate]);

  // Имя и телефон подставляем из Telegram — меньше ручного ввода.
  useEffect(() => {
    const tgUser = WebApp.initDataUnsafe?.user;
    if (tgUser?.first_name) {
      setForm((prev) => (prev.name ? prev : { ...prev, name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') }));
    }
    const saved = sessionStorage.getItem('mishkin_promo');
    if (saved) {
      try {
        setPromo(JSON.parse(saved));
      } catch {
        sessionStorage.removeItem('mishkin_promo');
      }
    }
  }, []);

  // Первый способ доставки выбираем сами, чтобы поле не было пустым.
  useEffect(() => {
    if (!deliveryId && delivery?.options.length) setDeliveryId(delivery.options[0].id);
  }, [delivery, deliveryId]);

  const goodsSum = getTotal();
  const discount = promo
    ? promo.discountType === 'PERCENT'
      ? Math.round(goodsSum * (promo.discountValue / 100))
      : Math.min(promo.discountValue, goodsSum)
    : 0;
  const goodsTotal = Math.max(0, goodsSum - discount);

  const option = useMemo(
    () => delivery?.options.find((o) => o.id === deliveryId),
    [delivery, deliveryId],
  );
  const freeDelivery = (delivery?.freeFrom ?? 0) > 0 && goodsTotal >= (delivery?.freeFrom ?? 0);
  const deliveryPrice = freeDelivery ? 0 : option?.price ?? 0;
  const finalTotal = goodsTotal + deliveryPrice;

  const needsAddress = option?.requiresAddress ?? true;

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setServerError('');
  };

  const validate = (): boolean => {
    const next: typeof errors = {};

    if (form.name.trim().length < 2) next.name = 'Укажите имя';
    if (!isValidPhone(form.phone)) next.phone = 'Введите телефон полностью';
    if (needsAddress) {
      if (!form.city.trim()) next.city = 'Укажите город';
      if (!form.address.trim()) next.address = 'Укажите адрес или пункт выдачи';
      if (!isValidPostal(form.postal)) next.postal = 'Индекс — 6 цифр';
    }
    if (!consent) next.consent = 'Нужно согласие на обработку данных';

    setErrors(next);
    if (Object.keys(next).length > 0) haptic.error();
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setServerError('');

    try {
      const order = await api.post<OrderResponse>('/orders', {
        items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
        userName: form.name.trim(),
        userPhone: phoneToE164(form.phone),
        userCity: needsAddress ? form.city.trim() : '',
        userAddress: needsAddress ? form.address.trim() : '',
        userPostal: needsAddress ? form.postal.trim() : '',
        deliveryMethod: deliveryId,
        comment: form.comment.trim(),
        promoCode: promo?.code,
        paymentType,
        consent: true,
      });

      orderSubmittedRef.current = true;
      clear();
      sessionStorage.removeItem('mishkin_promo');
      // Экран заказа умеет восстанавливаться после возврата из браузера оплаты.
      localStorage.setItem('mishkin_last_order', String(order.id));

      if (paymentType === 'ONLINE') {
        // Сам платёж запускает экран заказа: он живёт по устойчивому адресу,
        // умеет и форму внутри Mini App, и возврат из браузера, и повторную
        // попытку. Дублировать эту развилку в чекауте нечего.
        navigate(`/order/${order.id}`, { replace: true, state: { autoPay: true } });
        return;
      }

      haptic.celebrate();
      navigate(`/order/${order.id}`, { replace: true });
    } catch (err) {
      setServerError((err as Error).message || 'Не удалось создать заказ');
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  };

  // Основную кнопку рисуем сами: у Telegram MainButton нет состояния «ошибка».
  useEffect(() => {
    if (WebApp.initData) WebApp.MainButton.hide();
  }, []);

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light px-4 pb-bar-safe-lg pt-[calc(var(--app-top)+1.5rem)]"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={spring.soft}
    >
      <header className="mb-7 flex items-center gap-4">
        <button
          onClick={() => { haptic.tap(); navigate('/cart'); }}
          aria-label="Назад в корзину"
          className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90"
        >
          <Icon name="arrow_back" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main">Оформление</h1>
          <p className="text-2xs text-text-sub">Шаг 2 из 3 · доставка и оплата</p>
        </div>
      </header>

      <motion.div
        className="flex flex-col gap-7"
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="visible"
      >
        {/* ===== КОНТАКТЫ ===== */}
        <motion.section variants={fadeUp}>
          <SectionTitle icon="person" title="Контакты" />
          <div className="flex flex-col gap-3.5">
            <Field
              label="Ваше имя"
              required
              value={form.name}
              onChange={set('name')}
              placeholder="Как к вам обращаться?"
              error={errors.name}
              autoComplete="name"
            />
            <Field
              label="Телефон"
              required
              value={form.phone}
              onChange={(value) => set('phone')(formatPhone(value))}
              placeholder="+7 (___) ___-__-__"
              error={errors.phone}
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
        </motion.section>

        {/* ===== ДОСТАВКА ===== */}
        <motion.section variants={fadeUp}>
          <SectionTitle icon="shipping" title="Доставка" />

          {isLoading && !delivery ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 w-full" />)}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {delivery?.options.map((opt) => {
                const active = opt.id === deliveryId;
                const price = freeDelivery ? 0 : opt.price;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { haptic.select(); setDeliveryId(opt.id); setErrors({}); }}
                    className={`relative flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                      active ? 'border-primary bg-primary/[0.06]' : 'border-line bg-surface'
                    }`}
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        active ? 'border-primary' : 'border-line'
                      }`}
                    >
                      <AnimatePresence>
                        {active && (
                          <motion.span
                            className="size-2.5 rounded-full bg-primary"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={spring.snappy}
                          />
                        )}
                      </AnimatePresence>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-text-main">{opt.label}</span>
                      <span className="block text-2xs text-text-sub">{opt.hint}</span>
                    </span>
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${price === 0 ? 'text-primary' : 'text-text-main'}`}>
                      {price === 0 ? 'бесплатно' : `${money(price)} ₽`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Адрес нужен не всегда — для самовывоза поля просто не показываем */}
          <AnimatePresence initial={false}>
            {needsAddress && (
              <motion.div
                className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
              >
                <div className="flex flex-col gap-3.5 pt-3.5">
                  <Field
                    label="Город"
                    required
                    value={form.city}
                    onChange={set('city')}
                    placeholder="Город доставки"
                    error={errors.city}
                    autoComplete="address-level2"
                  />
                  <Field
                    label="Адрес или пункт выдачи"
                    required
                    value={form.address}
                    onChange={set('address')}
                    placeholder="Улица, дом, квартира / ПВЗ"
                    error={errors.address}
                    autoComplete="street-address"
                  />
                  <Field
                    label="Почтовый индекс"
                    value={form.postal}
                    onChange={(value) => set('postal')(value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    error={errors.postal}
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!needsAddress && option && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-pastel-ivory/70 p-3 text-2xs text-text-sub">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              {option.hint}. Адрес не нужен — время согласуем в переписке.
            </p>
          )}
        </motion.section>

        {/* ===== ОПЛАТА ===== */}
        <motion.section variants={fadeUp}>
          <SectionTitle icon="card" title="Оплата" />

          {payment?.test && (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-2xs font-semibold text-amber-800">
              <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
              {payment.mock
                ? 'Тестовый режим: оплата эмулируется, деньги не списываются.'
                : 'Тестовый магазин ЮKassa: реальных списаний нет, только тестовые карты.'}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {([
              {
                id: 'ONLINE' as PaymentType,
                title: `Онлайн — ${payment?.provider || 'ЮKassa'}`,
                hint: 'Карта, СБП, ЮMoney. Ссылка откроется сразу после оформления',
                icon: 'card' as const,
              },
              {
                id: 'MANUAL' as PaymentType,
                title: 'Договориться с менеджером',
                hint: 'Мы свяжемся и согласуем оплату и доставку',
                icon: 'chat' as const,
              },
            ]).map((method) => {
              const active = paymentType === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => { haptic.select(); setPaymentType(method.id); }}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                    active ? 'border-primary bg-primary/[0.06]' : 'border-line bg-surface'
                  }`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                      active ? 'bg-primary text-white' : 'bg-pastel-ivory text-text-sub'
                    }`}
                  >
                    <Icon name={method.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-text-main">{method.title}</span>
                    <span className="block text-2xs leading-snug text-text-sub">{method.hint}</span>
                  </span>
                  {active && <Icon name="check_circle" size={18} className="shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* ===== КОММЕНТАРИЙ ===== */}
        <motion.section variants={fadeUp}>
          <SectionTitle icon="chat" title="Комментарий" optional />
          <textarea
            value={form.comment}
            onChange={(e) => set('comment')(e.target.value)}
            placeholder="Пожелания к заказу, подарочная упаковка…"
            className="field min-h-[92px] resize-none"
          />
        </motion.section>

        {/* ===== ИТОГ ===== */}
        <motion.section variants={fadeUp}>
          <div className="rounded-2xl bg-pastel-ivory/70 p-5">
            <div className="mb-2 flex justify-between text-sm text-text-sub">
              <span>Товары ({items.reduce((acc, i) => acc + i.qty, 0)} шт.)</span>
              <span className="tabular-nums">{money(goodsSum)} ₽</span>
            </div>
            {discount > 0 && (
              <div className="mb-2 flex justify-between text-sm text-primary">
                <span>Скидка ({promo?.code})</span>
                <span className="tabular-nums">−{money(discount)} ₽</span>
              </div>
            )}
            <div className="mb-3 flex justify-between text-sm text-text-sub">
              <span>Доставка{option ? ` · ${option.label}` : ''}</span>
              <span className="tabular-nums">
                {deliveryPrice === 0 ? 'бесплатно' : `${money(deliveryPrice)} ₽`}
              </span>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-bold text-text-main">
              <span>К оплате</span>
              <AnimatedNumber value={finalTotal} suffix=" ₽" className="tabular-nums" />
            </div>
          </div>

          {/*
            Согласие на обработку ПДн (152-ФЗ). Раньше это был <label> с
            галочкой-<span> внутри: нажатие на текст ничего не переключало
            (label ни к какому input не привязан), а попадание по ссылке уводило
            в документы — поставить галочку удавалось только точно по квадратику
            20×20. Теперь вся строка — одна кнопка-чекбокс, а документы открывает
            отдельная ссылка ниже.
          */}
          <button
            type="button"
            role="checkbox"
            aria-checked={consent}
            aria-label="Согласен с условиями и обработкой персональных данных"
            onClick={() => { haptic.toggle(); setConsent((v) => !v); setErrors((p) => ({ ...p, consent: undefined })); }}
            className="mt-4 flex w-full items-start gap-3 py-1 text-left"
          >
            <span
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                consent ? 'border-primary bg-primary text-white' : errors.consent ? 'border-danger' : 'border-line'
              }`}
            >
              <AnimatePresence>
                {consent && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Icon name="check" size={13} strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="text-2xs leading-relaxed text-text-sub">
              Соглашаюсь с условиями продажи и обработкой персональных данных
            </span>
          </button>
          <button
            type="button"
            onClick={() => { haptic.tap(); navigate('/legal'); }}
            className="mt-1 pl-8 text-2xs font-semibold text-primary underline"
          >
            Прочитать документы
          </button>
          {errors.consent && (
            <p className="mt-1.5 pl-8 text-2xs text-danger">{errors.consent}</p>
          )}
        </motion.section>
      </motion.div>

      {/* ===== ЗАКРЕПЛЁННАЯ КНОПКА ===== */}
      <div className="action-bar">
        <div className="mx-auto max-w-lg">
          <AnimatePresence>
            {serverError && (
              <motion.p
                className="mb-2 flex items-start gap-1.5 rounded-xl bg-danger/10 p-2.5 text-2xs text-danger"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Icon name="alert" size={14} className="mt-px shrink-0" /> {serverError}
              </motion.p>
            )}
          </AnimatePresence>
          <motion.button
            className="btn-primary"
            whileTap={{ scale: 0.98 }}
            onClick={() => { haptic.press(); void submit(); }}
            disabled={submitting}
          >
            {!submitting && <span className="sheen opacity-25" />}
            <span className="relative flex items-center justify-center gap-2">
              {submitting ? (
                <>
                  <Icon name="spinner" size={18} className="animate-spin-slow" />
                  Оформляем…
                </>
              ) : paymentType === 'ONLINE' ? (
                <>Оплатить {money(finalTotal)} ₽</>
              ) : (
                <>Оформить заказ · {money(finalTotal)} ₽</>
              )}
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function SectionTitle({ icon, title, optional }: { icon: IconName; title: string; optional?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon name={icon} size={15} />
      </span>
      <h2 className="font-display text-base font-bold text-text-main">{title}</h2>
      {optional && <span className="text-2xs text-text-sub">необязательно</span>}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  inputMode?: 'text' | 'tel' | 'numeric' | 'email';
  autoComplete?: string;
}

/**
 * Поле ввода с подписью и ошибкой. Раньше каждый инпут в чекауте описывал
 * классы заново — расходились отступы, состояния и текст ошибок.
 */
function Field({ label, value, onChange, placeholder, error, required, inputMode, autoComplete }: FieldProps) {
  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className={`field ${error ? 'border-danger focus:border-danger focus:ring-danger/15' : ''}`}
      />
      <AnimatePresence>
        {error && (
          <motion.p
            className="mt-1.5 text-2xs text-danger"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
