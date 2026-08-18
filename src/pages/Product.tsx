import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { WebApp, isInTelegram } from '../utils/telegram';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';
import { haptic } from '../utils/haptics';
import { Icon } from '../components/Icon';
import { spring, fadeUp, staggerContainer, EASE_OUT } from '../utils/motion';

const money = (value: number) => value.toLocaleString('ru-RU');

function SkeletonProduct() {
  return (
    <div className="flex min-h-screen flex-col bg-background-light pb-24">
      <div className="skeleton h-[55vh] w-full" style={{ borderRadius: 0 }} />
      <div className="relative z-10 -mt-8 flex flex-col rounded-t-3xl bg-background-light px-6 pt-8">
        <div className="skeleton mb-3 h-3 w-24 rounded-lg" />
        <div className="skeleton mb-3 h-8 w-48 rounded-lg" />
        <div className="skeleton mb-6 h-6 w-20 rounded-lg" />
        <div className="mb-8 flex flex-col gap-2">
          <div className="skeleton h-3 w-full rounded-lg" />
          <div className="skeleton h-3 w-3/4 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function Product() {
  const navigate = useNavigate();
  const location = useLocation();
  const layoutIdPrefix = (location.state as { layoutIdPrefix?: string } | null)?.layoutIdPrefix || 'product';
  const { id } = useParams();

  const { currentProduct, isLoading, error, fetchProduct, products, fetchProducts } = useProductStore();
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);

  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Лёгкий параллакс шапки — фото «отстаёт» от контента при скролле.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, 80]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 1.12]);

  useEffect(() => {
    if (id) void fetchProduct(parseInt(id, 10));
    void fetchProducts();
    setQty(1);
    setActiveImg(0);
    setDescExpanded(false);
    if (isInTelegram()) WebApp.MainButton.hide();
  }, [id, fetchProduct, fetchProducts]);

  const handleAdd = () => {
    if (!currentProduct) return;
    haptic.addToCart();
    const prev = useCartStore.getState().items.find((i) => i.productId === currentProduct.id)?.qty ?? 0;
    addItem({
      productId: currentProduct.id,
      name: currentProduct.name,
      price: currentProduct.price,
      image: currentProduct.images[0] || '',
    });
    updateQty(currentProduct.id, prev + qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const share = () => {
    haptic.tap();
    const url = window.location.href;
    const text = `${currentProduct?.name} — MISHKIN`;
    if (isInTelegram() && WebApp.openTelegramLink) {
      WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    } else if (navigator.share) {
      void navigator.share({ title: text, url });
    }
  };

  const onGalleryScroll = () => {
    const el = galleryRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeImg) {
      setActiveImg(idx);
      haptic.select();
    }
  };

  if (error && !currentProduct && !isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background-light px-6 text-center">
        <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-danger/10">
          <Icon name="alert" size={26} className="text-danger" />
        </div>
        <h2 className="mb-2 font-display text-xl font-bold text-text-main">Товар не загрузился</h2>
        <p className="mb-7 max-w-[280px] text-sm text-text-sub">{error}</p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button
            className="btn-primary"
            onClick={() => { haptic.tap(); if (id) void fetchProduct(parseInt(id, 10)); }}
          >
            Повторить
          </button>
          <button className="btn-ghost" onClick={() => navigate('/catalog')}>В каталог</button>
        </div>
      </div>
    );
  }

  if (isLoading || !currentProduct) return <SkeletonProduct />;

  const product = currentProduct;
  const images = product.images.length > 0 ? product.images : [''];
  const related = products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);
  const lineTotal = product.price * qty;
  const longDescription = product.description.length > 180;

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-36"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Плавающие кнопки поверх фото */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-5">
        <motion.button
          onClick={() => { haptic.tap(); navigate(-1); }}
          aria-label="Назад"
          className="flex size-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md"
          whileTap={{ scale: 0.85 }}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.05, ...spring.snappy }}
        >
          <Icon name="arrow_back" />
        </motion.button>

        <div className="flex gap-2">
          <motion.button
            onClick={share}
            aria-label="Поделиться"
            className="flex size-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md"
            whileTap={{ scale: 0.85 }}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.05, ...spring.snappy }}
          >
            <Icon name="external" size={18} />
          </motion.button>
          <motion.button
            onClick={() => { haptic.tap(); navigate('/cart'); }}
            aria-label="Корзина"
            className="flex size-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md"
            whileTap={{ scale: 0.85 }}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1, ...spring.snappy }}
          >
            <Icon name="shopping_bag" size={19} />
          </motion.button>
        </div>
      </header>

      {/* Галерея со снапом и параллаксом */}
      <div className="relative h-[55vh] w-full overflow-hidden bg-pastel-sand/30">
        <motion.div style={{ y: heroY, scale: heroScale }} className="h-full w-full">
          <div
            ref={galleryRef}
            onScroll={onGalleryScroll}
            className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
          >
            {images.map((img, i) => (
              <div key={i} className="relative h-full w-full flex-shrink-0 snap-center">
                {img ? (
                  i === 0 ? (
                    <motion.img
                      layoutId={`${layoutIdPrefix}-${product.id}`}
                      src={img}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-pastel-sand/40">
                    <Icon name="package" size={40} className="text-text-sub/40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background-light/90 via-transparent to-transparent" />

        {!product.inStock && (
          <span className="absolute left-4 top-20 rounded-full bg-black/60 px-3 py-1 text-2xs font-bold uppercase tracking-wider text-white backdrop-blur-md">
            Нет в наличии
          </span>
        )}

        {images.length > 1 && (
          <div className="absolute bottom-10 left-0 right-0 z-10 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <motion.span
                key={i}
                className="h-1.5 rounded-full bg-white shadow"
                animate={{ width: i === activeImg ? 18 : 6, opacity: i === activeImg ? 1 : 0.55 }}
                transition={spring.snappy}
              />
            ))}
          </div>
        )}
      </div>

      {/* Описание */}
      <motion.div
        className="relative z-10 -mt-8 flex flex-col rounded-t-3xl bg-background-light px-5 pt-7"
        variants={staggerContainer(0.07, 0.1)}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="mb-3 flex items-center gap-2" variants={fadeUp}>
          <span className="chip bg-primary/10 text-primary">{product.category}</span>
          {product.isFeatured && (
            <span className="chip bg-accent/15 text-accent-deep">
              <Icon name="star" size={11} /> Хит
            </span>
          )}
        </motion.div>

        <motion.h1
          className="mb-2 font-display text-[26px] font-bold leading-tight text-text-main"
          variants={fadeUp}
        >
          {product.name}
        </motion.h1>

        <motion.p className="mb-5 text-xl font-bold tabular-nums text-primary" variants={fadeUp}>
          {money(product.price)} ₽
        </motion.p>

        <motion.div className="mb-6" variants={fadeUp}>
          <p
            className={`text-sm leading-relaxed text-text-sub ${
              longDescription && !descExpanded ? 'line-clamp-4' : ''
            }`}
          >
            {product.description}
          </p>
          {longDescription && (
            <button
              onClick={() => { haptic.tap(); setDescExpanded((v) => !v); }}
              className="mt-1.5 text-xs font-bold text-primary"
            >
              {descExpanded ? 'Свернуть' : 'Читать полностью'}
            </button>
          )}
        </motion.div>

        {/* Преимущества — короткие плашки вместо простыни текста */}
        <motion.div className="mb-7 grid grid-cols-3 gap-2" variants={fadeUp}>
          {([
            { icon: 'palette' as const, label: 'Ручная\nзаливка' },
            { icon: 'leaf' as const, label: 'Соевый\nвоск' },
            { icon: 'shipping' as const, label: 'Доставка\nпо РФ' },
          ]).map((item) => (
            <div
              key={item.icon}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-pastel-ivory/70 px-2 py-3 text-center"
            >
              <Icon name={item.icon} size={18} className="text-primary" />
              <span className="whitespace-pre-line text-[10px] font-semibold leading-tight text-text-sub">
                {item.label}
              </span>
            </div>
          ))}
        </motion.div>

        {related.length > 0 && (
          <motion.div className="mb-6" variants={fadeUp}>
            <h3 className="mb-3 text-2xs font-bold uppercase tracking-wider text-text-main">
              Похожие ароматы
            </h3>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
              {related.map((r) => (
                <motion.button
                  key={r.id}
                  className="min-w-[110px] max-w-[110px] flex-shrink-0 text-left"
                  onClick={() => { haptic.tap(); navigate(`/product/${r.id}`); }}
                  whileTap={{ scale: 0.94 }}
                >
                  <div className="mb-1.5 aspect-square w-full overflow-hidden rounded-xl bg-pastel-sand/30 shadow-soft">
                    {r.images[0] ? (
                      <img src={r.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full bg-pastel-ivory" />
                    )}
                  </div>
                  <h4 className="truncate text-xs font-bold text-text-main">{r.name}</h4>
                  <p className="text-2xs font-semibold tabular-nums text-primary">{money(r.price)} ₽</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ===== ЗАКРЕПЛЁННАЯ ПАНЕЛЬ ===== */}
      <motion.div
        className="glass-nav fixed bottom-0 left-0 right-0 z-30 border-t border-white/40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex items-center gap-1 rounded-2xl bg-pastel-ivory px-1.5 py-1.5">
            <button
              onClick={() => { if (qty > 1) { haptic.select(); setQty((q) => q - 1); } }}
              disabled={qty <= 1}
              aria-label="Уменьшить количество"
              className="flex size-9 items-center justify-center rounded-xl text-text-main transition-transform active:scale-90 disabled:opacity-30"
            >
              <Icon name="remove" size={18} />
            </button>
            <span className="w-6 text-center text-base font-bold tabular-nums text-text-main">{qty}</span>
            <button
              onClick={() => { haptic.select(); setQty((q) => Math.min(99, q + 1)); }}
              aria-label="Увеличить количество"
              className="flex size-9 items-center justify-center rounded-xl text-text-main transition-transform active:scale-90"
            >
              <Icon name="add" size={18} />
            </button>
          </div>

          <motion.button
            onClick={handleAdd}
            disabled={!product.inStock}
            whileTap={{ scale: 0.96 }}
            className={`relative flex-1 overflow-hidden rounded-2xl py-3.5 font-bold text-white shadow-lg transition-colors disabled:opacity-50 ${
              added ? 'bg-success shadow-success/25' : 'bg-primary shadow-glow'
            }`}
          >
            {!added && product.inStock && <span className="sheen opacity-30" />}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={added ? 'added' : 'add'}
                className="relative flex items-center justify-center gap-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                {!product.inStock ? (
                  'Нет в наличии'
                ) : added ? (
                  <>
                    <Icon name="check_circle" size={18} /> Добавлено
                  </>
                ) : (
                  <>В корзину · {money(lineTotal)} ₽</>
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
