import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';

function SkeletonProduct() {
  return (
    <div className="flex min-h-screen flex-col bg-background-light pb-24 animate-pulse">
      <div className="h-[60vh] w-full bg-pastel-sand/50" />
      <div className="relative z-10 -mt-10 flex flex-col rounded-t-3xl bg-background-light px-6 pt-8">
        <div className="h-3 w-24 rounded bg-pastel-sand/60 mb-3" />
        <div className="h-8 w-48 rounded bg-pastel-sand/60 mb-3" />
        <div className="h-6 w-20 rounded bg-pastel-sand/40 mb-6" />
        <div className="space-y-2 mb-8">
          <div className="h-3 w-full rounded bg-pastel-sand/40" />
          <div className="h-3 w-3/4 rounded bg-pastel-sand/40" />
          <div className="h-3 w-5/6 rounded bg-pastel-sand/40" />
        </div>
      </div>
    </div>
  );
}

export function Product() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentProduct, isLoading, fetchProduct } = useProductStore();
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    if (id) {
      fetchProduct(parseInt(id, 10));
    }
  }, [id, fetchProduct]);

  useEffect(() => {
    if (!currentProduct) return;

    // Show MainButton when product is loaded
    if (WebApp.initData) {
      WebApp.MainButton.text = `ДОБАВИТЬ В КОРЗИНУ — ${currentProduct.price.toLocaleString('ru-RU')} ₽`;
      WebApp.MainButton.color = "#3A5A2A";
      WebApp.MainButton.textColor = "#ffffff";
      WebApp.MainButton.show();
      
      const handleClick = () => {
        WebApp.HapticFeedback.impactOccurred('medium');
        addItem({
          productId: currentProduct.id,
          name: currentProduct.name,
          price: currentProduct.price,
          image: currentProduct.images[0] || '',
        });
        // Show brief confirmation
        WebApp.MainButton.text = "✓ ДОБАВЛЕНО";
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

  if (isLoading || !currentProduct) {
    return <SkeletonProduct />;
  }

  const product = currentProduct;

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-24"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      {/* Header overlaid on image */}
      <header className="absolute left-0 right-0 top-6 z-10 flex items-center justify-between px-4">
        <button 
          onClick={() => navigate(-1)} 
          className="flex size-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white transition-transform active:scale-90"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <button
          onClick={() => navigate('/cart')}
          className="flex size-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white transition-transform active:scale-90"
        >
          <span className="material-symbols-outlined">shopping_bag</span>
        </button>
      </header>

      {/* Product Gallery */}
      <div className="relative h-[60vh] w-full bg-pastel-sand overflow-hidden">
        {product.images[0] ? (
          <img 
            src={product.images[0]} 
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-pastel-sand/50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background-light via-transparent to-transparent z-0" />
      </div>

      {/* Details */}
      <div className="relative z-10 -mt-10 flex flex-col rounded-t-3xl bg-background-light px-6 pt-8">
        <span className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">{product.category}</span>
        <h1 className="mb-2 font-bahnschrift text-3xl font-bold text-text-main">{product.name}</h1>
        <p className="mb-6 text-xl font-medium text-text-main">{product.price.toLocaleString('ru-RU')} ₽</p>

        <p className="mb-8 leading-relaxed text-text-sub">
          {product.description}
        </p>

        {(product.topNote || product.heartNote || product.baseNote) && (
          <div className="mb-6 flex flex-col gap-4">
            <h3 className="font-bahnschrift text-sm font-bold uppercase tracking-wider text-text-main">Ноты аромата</h3>
            <div className="flex gap-4">
              {product.topNote && (
                <motion.div 
                  className="flex flex-1 flex-col items-center rounded-xl border border-pastel-sand p-3 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <span className="mb-1 text-xs text-text-sub">Верхние</span>
                  <span className="font-medium text-text-main">{product.topNote}</span>
                </motion.div>
              )}
              {product.heartNote && (
                <motion.div 
                  className="flex flex-1 flex-col items-center rounded-xl border border-pastel-sand p-3 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span className="mb-1 text-xs text-text-sub">Сердце</span>
                  <span className="font-medium text-text-main">{product.heartNote}</span>
                </motion.div>
              )}
              {product.baseNote && (
                <motion.div 
                  className="flex flex-1 flex-col items-center rounded-xl border border-pastel-sand p-3 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="mb-1 text-xs text-text-sub">База</span>
                  <span className="font-medium text-text-main">{product.baseNote}</span>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Fallback add button for non-Telegram browsers */}
        {!WebApp.initData && (
          <motion.button
            className="mt-2 w-full rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              addItem({
                productId: product.id,
                name: product.name,
                price: product.price,
                image: product.images[0] || '',
              });
              navigate('/cart');
            }}
          >
            ДОБАВИТЬ В КОРЗИНУ — {product.price.toLocaleString('ru-RU')} ₽
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
