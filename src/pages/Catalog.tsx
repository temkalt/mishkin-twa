import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WebApp } from '../utils/telegram';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';

function SkeletonGrid() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-2 animate-pulse">
          <div className="relative aspect-[3/4] w-full rounded-2xl bg-pastel-sand/40" />
          <div className="px-1">
            <div className="h-2 w-12 rounded bg-pastel-sand/40 mb-1" />
            <div className="h-4 w-20 rounded bg-pastel-sand/50 mb-1" />
            <div className="h-3 w-16 rounded bg-pastel-sand/30" />
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [addedId, setAddedId] = useState<number | null>(null);

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
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1200);
  };

  const filtered = searchQuery
    ? products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-light/80 backdrop-blur-xl px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80 transition-all active:scale-90"
            >
              <span className="material-symbols-outlined text-text-main text-[20px]">arrow_back</span>
            </button>
            <h1 className="font-display text-xl font-bold text-text-main">Каталог</h1>
          </div>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80 transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-text-main text-[20px]">
              {showSearch ? 'close' : 'search'}
            </span>
          </button>
        </div>

        {/* Search */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск свечей..."
                autoFocus
                className="mb-3 w-full rounded-xl border border-pastel-sand/60 bg-pastel-ivory/50 px-4 py-3 text-sm text-text-main outline-none focus:border-primary/40 transition-colors placeholder:text-text-sub/50"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-pastel-ivory/80 text-text-sub hover:bg-pastel-sand/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Results count */}
      <div className="px-5 py-3">
        <p className="text-xs text-text-sub">
          {filtered.length} {filtered.length === 1 ? 'товар' : filtered.length < 5 ? 'товара' : 'товаров'}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 px-4">
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          filtered.map((p, index) => (
            <motion.div
              key={p.id}
              className="flex flex-col gap-2 cursor-pointer"
              onClick={() => navigate(`/product/${p.id}`)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, type: 'spring', damping: 25 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-pastel-sand/30">
                {p.images[0] ? (
                  <motion.img
                    layoutId={`product-img-${p.id}`}
                    src={p.images[0]}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-pastel-ivory" />
                )}

                {/* Category tag */}
                <span className="absolute top-2 left-2 rounded-full bg-white/70 backdrop-blur-md px-2 py-0.5 text-[9px] font-semibold text-text-main">
                  {p.category}
                </span>

                {/* Add to cart button */}
                <motion.button
                  className={`absolute bottom-2.5 right-2.5 flex size-9 items-center justify-center rounded-full shadow-lg transition-all ${
                    addedId === p.id
                      ? 'bg-primary text-white'
                      : 'bg-white/80 backdrop-blur-md text-text-main hover:bg-white'
                  }`}
                  whileTap={{ scale: 0.8 }}
                  onClick={(e) => handleAddToCart(e, p)}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {addedId === p.id ? 'check' : 'add'}
                  </span>
                </motion.button>
              </div>
              <div className="px-1">
                <h4 className="text-sm font-bold text-text-main line-clamp-1">{p.name}</h4>
                <p className="text-xs font-medium text-text-sub">
                  {p.price.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <span className="material-symbols-outlined text-5xl text-pastel-sand mb-3">search_off</span>
          <h3 className="font-display text-lg font-bold text-text-main mb-1">Ничего не найдено</h3>
          <p className="text-sm text-text-sub">Попробуйте другой запрос или категорию</p>
        </div>
      )}
    </motion.div>
  );
}
