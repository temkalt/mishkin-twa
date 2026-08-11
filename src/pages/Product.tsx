import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { WebApp } from '../utils/telegram';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';
import { haptic } from '../utils/haptics';
import { spring, fadeUp, staggerContainer } from '../utils/motion';

function SkeletonProduct() {
  return (
    <div className="flex min-h-screen flex-col bg-background-light pb-24">
      <div className="skeleton h-[55vh] w-full rounded-none" style={{ borderRadius: 0 }} />
      <div className="relative z-10 -mt-8 flex flex-col rounded-t-3xl bg-background-light px-6 pt-8">
        <div className="skeleton h-3 w-24 rounded-lg mb-3" />
        <div className="skeleton h-8 w-48 rounded-lg mb-3" />
        <div className="skeleton h-6 w-20 rounded-lg mb-6" />
        <div className="flex flex-col gap-2 mb-8">
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
  const layoutIdPrefix = location.state?.layoutIdPrefix || 'product';
  const { id } = useParams();
  const { currentProduct, isLoading, fetchProduct, products, fetchProducts } = useProductStore();
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) fetchProduct(parseInt(id, 10));
    if (products.length === 0) fetchProducts();
    setQty(1);
    setActiveImg(0);
    if (WebApp.initData) WebApp.MainButton.hide();
  }, [id, fetchProduct, fetchProducts, products.length]);

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

  const onGalleryScroll = () => {
    const el = galleryRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeImg) {
      setActiveImg(idx);
      haptic.select();
    }
  };

  if (isLoading || !currentProduct) {
    return <SkeletonProduct />;
  }

  const product = currentProduct;
  const images = product.images.length > 0 ? product.images : [''];
  const related = products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4);
  const lineTotal = product.price * qty;

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-32"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header overlaid on image */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-5">
        <motion.button
          onClick={() => { haptic.tap(); navigate(-1); }}
          className="flex size-10 items-center justify-center rounded-full bg-black/25 backdrop-blur-md text-white"
          whileTap={{ scale: 0.85 }}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 22 }}
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </motion.button>
        <motion.button
          onClick={() => { haptic.tap(); navigate('/cart'); }}
          className="flex size-10 items-center justify-center rounded-full bg-black/25 backdrop-blur-md text-white"
          whileTap={{ scale: 0.85 }}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 22 }}
        >
          <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
        </motion.button>
      </header>

      {/* Product Image gallery — swipeable, scroll-snap */}
      <div className="relative h-[55vh] w-full bg-pastel-sand/30 overflow-hidden">
        <div
          ref={galleryRef}
          onScroll={onGalleryScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto no-scrollbar"
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
                  <img src={img} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                )
              ) : (
                <div className="h-full w-full bg-pastel-sand/40" />
              )}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background-light/90 via-transparent to-transparent" />

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

      {/* Details — stagger reveal */}
      <motion.div
        className="relative z-10 -mt-8 flex flex-col rounded-t-3xl bg-background-light px-5 pt-7"
        variants={staggerContainer(0.07, 0.1)}
        initial="hidden"
        animate="visible"
      >
        {/* Tags */}
        <motion.div className="flex items-center gap-2 mb-3" variants={fadeUp}>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
            {product.category}
          </span>
          {product.isFeatured && (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold text-accent uppercase tracking-wider">
              Хит
            </span>
          )}
        </motion.div>

        {/* Name */}
        <motion.h1
          className="mb-2 font-display text-2xl font-bold text-text-main leading-tight"
          variants={fadeUp}
        >
          {product.name}
        </motion.h1>

        {/* Price */}
        <motion.p className="mb-5 text-xl font-bold text-primary" variants={fadeUp}>
          {product.price.toLocaleString('ru-RU')} ₽
        </motion.p>

        {/* Description */}
        <motion.p className="mb-6 text-sm leading-relaxed text-text-sub" variants={fadeUp}>
          {product.description}
        </motion.p>

        {/* Related products */}
        {related.length > 0 && (
          <motion.div className="mb-6" variants={fadeUp}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-main">
              Похожие товары
            </h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {related.map((r) => (
                <motion.div
                  key={r.id}
                  className="min-w-[110px] max-w-[110px] flex-shrink-0 cursor-pointer"
                  onClick={() => { haptic.tap(); navigate(`/product/${r.id}`); }}
                  whileTap={{ scale: 0.94 }}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-pastel-sand/30 mb-1.5 shadow-soft">
                    <img src={r.images[0]} alt={r.name} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <h4 className="text-xs font-bold text-text-main truncate">{r.name}</h4>
                  <p className="text-[10px] font-semibold text-primary">
                    {r.price.toLocaleString('ru-RU')} ₽
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ===== STICKY ACTION BAR ===== */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-30 glass-nav border-t border-white/40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {/* Quantity stepper */}
          <div className="flex items-center gap-1 rounded-2xl bg-pastel-ivory px-1.5 py-1.5">
            <button
              onClick={() => { if (qty > 1) { haptic.select(); setQty((q) => q - 1); } }}
              disabled={qty <= 1}
              className="flex size-9 items-center justify-center rounded-xl text-text-main transition-transform active:scale-90 disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[20px]">remove</span>
            </button>
            <span className="w-6 text-center text-base font-bold tabular-nums text-text-main">{qty}</span>
            <button
              onClick={() => { haptic.select(); setQty((q) => Math.min(99, q + 1)); }}
              className="flex size-9 items-center justify-center rounded-xl text-text-main transition-transform active:scale-90"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>

          {/* Add to cart */}
          <motion.button
            onClick={handleAdd}
            whileTap={{ scale: 0.96 }}
            className={`relative flex-1 overflow-hidden rounded-2xl py-3.5 font-bold text-white shadow-lg transition-colors ${
              added ? 'bg-emerald-500 shadow-emerald-500/25' : 'bg-primary shadow-glow'
            }`}
          >
            {!added && <span className="sheen opacity-30" />}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={added ? 'added' : 'add'}
                className="relative flex items-center justify-center gap-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {added ? (
                  <>
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    Добавлено
                  </>
                ) : (
                  <>В корзину · {lineTotal.toLocaleString('ru-RU')} ₽</>
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
