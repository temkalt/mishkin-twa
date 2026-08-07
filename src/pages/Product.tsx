import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { WebApp } from '../utils/telegram';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';

import type { Variants } from 'framer-motion';

const detailsStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const slideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
};

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
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProduct(parseInt(id, 10));
    }
    if (products.length === 0) {
      fetchProducts();
    }
  }, [id, fetchProduct, fetchProducts, products.length]);

  useEffect(() => {
    if (!currentProduct) return;

    if (WebApp.initData) {
      WebApp.MainButton.text = `ДОБАВИТЬ В КОРЗИНУ — ${currentProduct.price.toLocaleString('ru-RU')} ₽`;
      WebApp.MainButton.color = '#3A5A2A';
      WebApp.MainButton.textColor = '#ffffff';
      WebApp.MainButton.show();

      const handleClick = () => {
        WebApp.HapticFeedback.impactOccurred('medium');
        addItem({
          productId: currentProduct.id,
          name: currentProduct.name,
          price: currentProduct.price,
          image: currentProduct.images[0] || '',
        });
        WebApp.MainButton.text = '✓ ДОБАВЛЕНО';
        setTimeout(() => {
          WebApp.MainButton.text = `ДОБАВИТЬ В КОРЗИНУ — ${currentProduct.price.toLocaleString('ru-RU')} ₽`;
        }, 1200);
      };

      WebApp.onEvent('mainButtonClicked', handleClick);
      return () => {
        WebApp.MainButton.hide();
        WebApp.offEvent('mainButtonClicked', handleClick);
      };
    }
  }, [currentProduct, addItem]);

  const handleAdd = () => {
    if (!currentProduct) return;
    if (WebApp.initData) WebApp.HapticFeedback.impactOccurred('medium');
    addItem({
      productId: currentProduct.id,
      name: currentProduct.name,
      price: currentProduct.price,
      image: currentProduct.images[0] || '',
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  if (isLoading || !currentProduct) {
    return <SkeletonProduct />;
  }

  const product = currentProduct;
  const related = products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header overlaid on image */}
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 pt-5">
        <motion.button
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center rounded-full bg-black/25 backdrop-blur-md text-white"
          whileTap={{ scale: 0.85 }}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 22 }}
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </motion.button>
        <motion.button
          onClick={() => navigate('/cart')}
          className="flex size-10 items-center justify-center rounded-full bg-black/25 backdrop-blur-md text-white"
          whileTap={{ scale: 0.85 }}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 22 }}
        >
          <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
        </motion.button>
      </header>

      {/* Product Image — layoutId only, no conflicting initial scale */}
      <div className="relative h-[55vh] w-full bg-pastel-sand/30 overflow-hidden">
        {product.images[0] ? (
          <motion.img
            layoutId={`${layoutIdPrefix}-${product.id}`}
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-pastel-sand/40" />
        )}
        {/* Gradient at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-background-light/90 via-transparent to-transparent" />
      </div>

      {/* Details — stagger reveal */}
      <motion.div
        className="relative z-10 -mt-8 flex flex-col rounded-t-3xl bg-background-light px-5 pt-7"
        variants={detailsStagger}
        initial="hidden"
        animate="visible"
      >
        {/* Tags */}
        <motion.div className="flex items-center gap-2 mb-3" variants={slideUp}>
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
          variants={slideUp}
        >
          {product.name}
        </motion.h1>

        {/* Price */}
        <motion.p
          className="mb-5 text-xl font-bold text-primary"
          variants={slideUp}
        >
          {product.price.toLocaleString('ru-RU')} ₽
        </motion.p>

        {/* Description */}
        <motion.p
          className="mb-6 text-sm leading-relaxed text-text-sub"
          variants={slideUp}
        >
          {product.description}
        </motion.p>

        {/* Related products */}
        {related.length > 0 && (
          <motion.div className="mb-6" variants={slideUp}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-main">
              Похожие товары
            </h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {related.map((r) => (
                <motion.div
                  key={r.id}
                  className="min-w-[110px] max-w-[110px] flex-shrink-0 cursor-pointer"
                  onClick={() => navigate(`/product/${r.id}`)}
                  whileTap={{ scale: 0.94 }}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-pastel-sand/30 mb-1.5">
                    <img
                      src={r.images[0]}
                      alt={r.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
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

        {/* Fallback add button — non-Telegram */}
        {!WebApp.initData && (
          <motion.button
            className={`mt-2 w-full rounded-2xl py-4 font-bold text-white shadow-lg transition-all ${
              added ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-primary shadow-primary/20'
            }`}
            whileTap={{ scale: 0.97 }}
            onClick={handleAdd}
            variants={slideUp}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={added ? 'added' : 'add'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {added
                  ? '✓ Добавлено в корзину'
                  : `Добавить в корзину — ${product.price.toLocaleString('ru-RU')} ₽`}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}
