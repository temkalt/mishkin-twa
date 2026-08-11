import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';
import { haptic } from '../utils/haptics';

const staggerGrid: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 240, damping: 24 },
  },
};

function SkeletonGrid() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="skeleton aspect-[3/4] w-full rounded-2xl" />
          <div className="px-1 flex flex-col gap-1.5">
            <div className="skeleton h-2 w-12 rounded-lg" />
            <div className="skeleton h-4 w-20 rounded-lg" />
            <div className="skeleton h-3 w-16 rounded-lg" />
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
    if (cat === activeCategory) return;
    haptic.select();
    setActiveCategory(cat);
    fetchProducts(cat);
  };

  const handleAddToCart = (e: React.MouseEvent, product: typeof products[0]) => {
    e.stopPropagation();
    haptic.addToCart();
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
      <header className="sticky top-0 z-40 glass-nav px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => { haptic.tap(); navigate(-1); }}
              className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80"
              whileTap={{ scale: 0.85 }}
            >
              <span className="material-symbols-outlined text-text-main text-[20px]">arrow_back</span>
            </motion.button>
            <h1 className="font-display text-xl font-bold text-text-main">Каталог</h1>
          </div>
          <motion.button
            onClick={() => { haptic.tap(); setShowSearch(!showSearch); }}
            className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80"
            whileTap={{ scale: 0.85 }}
          >
            <span className="material-symbols-outlined text-text-main text-[20px]">
              {showSearch ? 'close' : 'search'}
            </span>
          </motion.button>
        </div>

        {/* Search */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск свечей..."
                autoFocus
                className="mb-3 w-full rounded-xl border border-pastel-sand/60 bg-pastel-ivory/50 px-4 py-3 text-sm text-text-main outline-none focus:border-primary/50 transition-colors placeholder:text-text-sub/50"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Filters — with layoutId indicator */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className="relative whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors"
                style={{ color: isActive ? '#fff' : '' }}
              >
                {isActive && (
                  <motion.span
                    layoutId="category-pill"
                    className="absolute inset-0 rounded-full bg-primary shadow-md shadow-primary/25"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span
                  className={`relative z-10 transition-colors ${
                    isActive ? 'text-white' : 'text-text-sub'
                  }`}
                >
                  {cat}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Results count */}
      <div className="px-5 py-3">
        <p className="text-xs text-text-sub">
          {filtered.length}{' '}
          {filtered.length === 1
            ? 'товар'
            : filtered.length < 5
            ? 'товара'
            : 'товаров'}
        </p>
      </div>

      {/* Grid */}
      <motion.div
        className="grid grid-cols-2 gap-3 px-4"
        variants={staggerGrid}
        initial="hidden"
        animate="visible"
        key={activeCategory + searchQuery}
      >
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          filtered.map((p) => (
            <motion.div
              key={p.id}
              className="flex flex-col gap-2 cursor-pointer"
              onClick={() => { haptic.tap(); navigate(`/product/${p.id}`, { state: { layoutIdPrefix: 'catalog' } }); }}
              variants={cardVariant}
              whileTap={{ scale: 0.96 }}
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-pastel-sand/30">
                {p.images[0] ? (
                  <motion.img
                    layoutId={`catalog-${p.id}`}
                    src={p.images[0]}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-pastel-ivory" />
                )}

                {/* Category tag */}
                <span className="absolute top-2 left-2 rounded-full bg-white/75 backdrop-blur-md px-2 py-0.5 text-[9px] font-semibold text-text-main">
                  {p.category}
                </span>

                {/* Add to cart button with pulse ring */}
                <div className="absolute bottom-2.5 right-2.5">
                  {addedId === p.id && (
                    <motion.span
                      className="absolute inset-0 rounded-full bg-primary"
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                  <motion.button
                    className={`flex size-9 items-center justify-center rounded-full shadow-lg ${
                      addedId === p.id
                        ? 'bg-primary text-white'
                        : 'bg-white/85 backdrop-blur-md text-text-main'
                    }`}
                    whileTap={{ scale: 0.8 }}
                    onClick={(e) => handleAddToCart(e, p)}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={addedId === p.id ? 'check' : 'add'}
                        className="material-symbols-outlined text-[18px]"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        {addedId === p.id ? 'check' : 'add'}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>

              <div className="px-1">
                <h4 className="text-sm font-bold text-text-main line-clamp-1">{p.name}</h4>
                <p className="text-xs font-semibold text-primary">
                  {p.price.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Empty state */}
      <AnimatePresence>
        {!isLoading && filtered.length === 0 && (
          <motion.div
            className="flex flex-col items-center justify-center py-16 text-center px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span className="material-symbols-outlined text-5xl text-pastel-sand mb-3">search_off</span>
            <h3 className="font-display text-lg font-bold text-text-main mb-1">Ничего не найдено</h3>
            <p className="text-sm text-text-sub">Попробуйте другой запрос или категорию</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
