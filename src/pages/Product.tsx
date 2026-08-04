import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';

function SkeletonProduct() {
  return (
    <div className="flex min-h-screen flex-col bg-background-light pb-24 animate-pulse">
      <div className="h-[55vh] w-full bg-pastel-sand/40" />
      <div className="relative z-10 -mt-8 flex flex-col rounded-t-3xl bg-background-light px-6 pt-8">
        <div className="h-3 w-24 rounded bg-pastel-sand/50 mb-3" />
        <div className="h-8 w-48 rounded bg-pastel-sand/50 mb-3" />
        <div className="h-6 w-20 rounded bg-pastel-sand/40 mb-6" />
        <div className="space-y-2 mb-8">
          <div className="h-3 w-full rounded bg-pastel-sand/30" />
          <div className="h-3 w-3/4 rounded bg-pastel-sand/30" />
        </div>
      </div>
    </div>
  );
}

export function Product() {
  const navigate = useNavigate();
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
  const related = products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 3);

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header overlaid on image */}
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 pt-5">
        <button
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white transition-all active:scale-90"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <button
          onClick={() => navigate('/cart')}
          className="flex size-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white transition-all active:scale-90"
        >
          <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
        </button>
      </header>

      {/* Product Image */}
      <div className="relative h-[55vh] w-full bg-pastel-sand/30 overflow-hidden">
        {product.images[0] ? (
          <motion.img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover"
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6 }}
          />
        ) : (
          <div className="h-full w-full bg-pastel-sand/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background-light via-transparent to-transparent" />
      </div>

      {/* Details */}
      <div className="relative z-10 -mt-8 flex flex-col rounded-t-3xl bg-background-light px-5 pt-7">
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
            {product.category}
          </span>
          {product.isFeatured && (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold text-accent uppercase tracking-wider">
              Хит
            </span>
          )}
        </div>

        <h1 className="mb-2 font-display text-2xl font-bold text-text-main">{product.name}</h1>
        <p className="mb-5 text-xl font-bold text-primary">{product.price.toLocaleString('ru-RU')} ₽</p>

        <p className="mb-6 text-sm leading-relaxed text-text-sub">{product.description}</p>

        {/* Aroma notes */}
        {(product.topNote || product.heartNote || product.baseNote) && (
          <div className="mb-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-main">Ноты аромата</h3>
            <div className="flex gap-2.5">
              {product.topNote && (
                <motion.div
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-pastel-ivory/60 p-3.5 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <span className="text-[10px] text-text-sub font-medium">Верхние</span>
                  <span className="text-xs font-bold text-text-main">{product.topNote}</span>
                </motion.div>
              )}
              {product.heartNote && (
                <motion.div
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-pastel-ivory/60 p-3.5 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span className="text-[10px] text-text-sub font-medium">Сердце</span>
                  <span className="text-xs font-bold text-text-main">{product.heartNote}</span>
                </motion.div>
              )}
              {product.baseNote && (
                <motion.div
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-pastel-ivory/60 p-3.5 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="text-[10px] text-text-sub font-medium">База</span>
                  <span className="text-xs font-bold text-text-main">{product.baseNote}</span>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Specs */}
        <div className="mb-6 grid grid-cols-3 gap-2.5">
          {[
            { icon: 'local_fire_department', label: 'Горение', val: '45–60 ч' },
            { icon: 'straighten', label: 'Объём', val: '200 мл' },
            { icon: 'eco', label: 'Воск', val: 'Соевый' },
          ].map((spec) => (
            <div key={spec.label} className="flex flex-col items-center gap-1 rounded-xl border border-pastel-sand/40 p-3 text-center">
              <span className="material-symbols-outlined text-primary text-[18px]">{spec.icon}</span>
              <span className="text-[10px] text-text-sub">{spec.label}</span>
              <span className="text-xs font-bold text-text-main">{spec.val}</span>
            </div>
          ))}
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-main">Похожие товары</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {related.map((r) => (
                <motion.div
                  key={r.id}
                  className="min-w-[120px] max-w-[120px] flex-shrink-0 cursor-pointer"
                  onClick={() => navigate(`/product/${r.id}`)}
                  whileTap={{ scale: 0.96 }}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-pastel-sand/30 mb-1.5">
                    <img src={r.images[0]} alt={r.name} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <h4 className="text-xs font-bold text-text-main truncate">{r.name}</h4>
                  <p className="text-[10px] text-text-sub">{r.price.toLocaleString('ru-RU')} ₽</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback add button for non-Telegram */}
        {!WebApp.initData && (
          <motion.button
            className={`mt-2 w-full rounded-2xl py-4 font-bold text-white shadow-lg transition-all ${
              added ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-primary shadow-primary/20'
            }`}
            whileTap={{ scale: 0.97 }}
            onClick={handleAdd}
          >
            {added ? '✓ Добавлено в корзину' : `Добавить в корзину — ${product.price.toLocaleString('ru-RU')} ₽`}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
