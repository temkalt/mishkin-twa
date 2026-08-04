import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';

function SkeletonGrid() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-2 animate-pulse">
          <div className="relative aspect-[3/4] w-full rounded-2xl bg-pastel-sand/50" />
          <div className="px-1">
            <div className="h-2 w-12 rounded bg-pastel-sand/40 mb-1" />
            <div className="h-4 w-20 rounded bg-pastel-sand/60 mb-1" />
            <div className="h-3 w-16 rounded bg-pastel-sand/40" />
          </div>
        </div>
      ))}
    </>
  );
}

export function Catalog() {
  const navigate = useNavigate();
  const { products, categories, isLoading, fetchProducts, fetchCategories } = useProductStore();
  const addItem = useCartStore((s) => s.addItem);
  const [activeCategory, setActiveCategory] = useState('Все');

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchProducts]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    fetchProducts(cat);
  };

  const handleAddToCart = (e: React.MouseEvent, product: typeof products[0]) => {
    e.stopPropagation();
    if (WebApp.initData) {
      WebApp.HapticFeedback.impactOccurred('light');
    }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] || '',
    });
  };

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light px-4 pb-20 pt-6"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <header className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-bahnschrift text-2xl font-bold text-text-main">Каталог</h1>
        <button className="ml-auto flex size-10 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90">
          <span className="material-symbols-outlined">tune</span>
        </button>
      </header>

      {/* Filters */}
      <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {categories.map((cat) => (
          <button 
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              activeCategory === cat ? 'bg-primary text-white' : 'bg-pastel-ivory text-text-main'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          products.map((p, index) => (
            <motion.div 
              key={p.id}
              className="flex flex-col gap-2"
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(`/product/${p.id}`)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-pastel-sand/50">
                {p.images[0] ? (
                  <img 
                    src={p.images[0]} 
                    alt={p.name} 
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-pastel-ivory" />
                )}
                <motion.button 
                  className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-primary text-white shadow-md transition-transform active:scale-75"
                  whileTap={{ rotate: 90, scale: 0.8 }}
                  onClick={(e) => handleAddToCart(e, p)}
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </motion.button>
              </div>
              <div className="px-1">
                <span className="text-[10px] uppercase tracking-widest text-text-sub">{p.category}</span>
                <h4 className="font-bold text-text-main line-clamp-1">{p.name}</h4>
                <p className="text-sm font-medium text-text-main">{p.price.toLocaleString('ru-RU')} ₽</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {!isLoading && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-pastel-sand mb-3">search_off</span>
          <h3 className="font-bahnschrift text-lg font-bold text-text-main mb-1">Ничего не найдено</h3>
          <p className="text-sm text-text-sub">Попробуйте выбрать другую категорию</p>
        </div>
      )}
    </motion.div>
  );
}
