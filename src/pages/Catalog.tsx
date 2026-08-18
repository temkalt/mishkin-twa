import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';
import { haptic } from '../utils/haptics';
import { Icon } from '../components/Icon';
import { EASE_OUT } from '../utils/motion';

const money = (value: number) => value.toLocaleString('ru-RU');

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
          <div className="flex flex-col gap-1.5 px-1">
            <div className="skeleton h-4 w-20 rounded-lg" />
            <div className="skeleton h-3 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Правильная форма слова «товар» для числа. */
function plural(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'товар';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'товара';
  return 'товаров';
}

export function Catalog() {
  const navigate = useNavigate();
  const { products, categories, isLoading, error, fetchProducts, fetchCategories } = useProductStore();
  const addItem = useCartStore((s) => s.addItem);

  const [activeCategory, setActiveCategory] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [addedId, setAddedId] = useState<number | null>(null);

  useEffect(() => {
    void fetchCategories();
    void fetchProducts();
  }, [fetchCategories, fetchProducts]);

  const handleCategoryChange = (cat: string) => {
    if (cat === activeCategory) return;
    haptic.select();
    setActiveCategory(cat);
    void fetchProducts(cat);
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

  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query),
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
      <header className="glass-nav sticky top-0 z-40 px-5 pb-3 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => { haptic.tap(); navigate(-1); }}
              aria-label="Назад"
              className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80"
              whileTap={{ scale: 0.85 }}
            >
              <Icon name="arrow_back" />
            </motion.button>
            <h1 className="font-display text-xl font-bold text-text-main">Каталог</h1>
          </div>
          <motion.button
            onClick={() => {
              haptic.tap();
              setShowSearch((v) => !v);
              if (showSearch) setSearchQuery('');
            }}
            aria-label={showSearch ? 'Закрыть поиск' : 'Поиск'}
            className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80"
            whileTap={{ scale: 0.85 }}
          >
            <Icon name={showSearch ? 'close' : 'search'} />
          </motion.button>
        </div>

        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Название, категория, нота…"
                aria-label="Поиск по каталогу"
                autoFocus
                className="field mb-3 !py-3 text-sm"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                aria-pressed={isActive}
                className="relative whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold"
              >
                {isActive && (
                  <motion.span
                    layoutId="category-pill"
                    className="absolute inset-0 rounded-full bg-primary shadow-md shadow-primary/25"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className={`relative z-10 transition-colors ${isActive ? 'text-white' : 'text-text-sub'}`}>
                  {cat}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {!error && (
        <div className="px-5 py-3">
          <p className="text-xs text-text-sub">
            {isLoading ? 'Загружаем…' : `${filtered.length} ${plural(filtered.length)}`}
          </p>
        </div>
      )}

      {/* Ошибка загрузки — раньше выглядела как «ничего не найдено» */}
      {error && !isLoading && (
        <div className="mx-4 mt-4 card p-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-danger/10">
            <Icon name="alert" size={22} className="text-danger" />
          </div>
          <h3 className="mb-1 font-display text-base font-bold text-text-main">Каталог не загрузился</h3>
          <p className="mb-4 text-xs text-text-sub">{error}</p>
          <button
            onClick={() => { haptic.tap(); void fetchProducts(activeCategory, true); }}
            className="text-xs font-bold text-primary underline"
          >
            Повторить
          </button>
        </div>
      )}

      <motion.div
        className="grid grid-cols-2 gap-3 px-4"
        variants={staggerGrid}
        initial="hidden"
        animate="visible"
        key={activeCategory + query}
      >
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          filtered.map((p) => (
            <motion.div
              key={p.id}
              className="flex cursor-pointer flex-col gap-2"
              onClick={() => { haptic.tap(); navigate(`/product/${p.id}`, { state: { layoutIdPrefix: 'catalog' } }); }}
              variants={cardVariant}
              whileTap={{ scale: 0.96 }}
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-pastel-sand/30 shadow-soft">
                {p.images[0] ? (
                  <motion.img
                    layoutId={`catalog-${p.id}`}
                    src={p.images[0]}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-pastel-ivory">
                    <Icon name="package" size={26} className="text-text-sub/40" />
                  </div>
                )}

                <span className="absolute left-2 top-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-text-main backdrop-blur-md">
                  {p.category}
                </span>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/20 to-transparent" />

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
                    aria-label={`Добавить «${p.name}» в корзину`}
                    className={`flex size-9 items-center justify-center rounded-full shadow-lg ${
                      addedId === p.id ? 'bg-primary text-white' : 'bg-white/90 text-text-main backdrop-blur-md'
                    }`}
                    whileTap={{ scale: 0.8 }}
                    onClick={(e) => handleAddToCart(e, p)}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={addedId === p.id ? 'check' : 'add'}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Icon name={addedId === p.id ? 'check' : 'add'} size={17} />
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>

              <div className="px-1">
                <h4 className="line-clamp-1 text-sm font-bold text-text-main">{p.name}</h4>
                <p className="text-xs font-semibold tabular-nums text-primary">{money(p.price)} ₽</p>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      <AnimatePresence>
        {!isLoading && !error && filtered.length === 0 && (
          <motion.div
            className="flex flex-col items-center justify-center px-6 py-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-pastel-ivory">
              <Icon name="search_off" size={28} className="text-pastel-sand" />
            </div>
            <h3 className="mb-1 font-display text-lg font-bold text-text-main">Ничего не найдено</h3>
            <p className="mb-5 text-sm text-text-sub">Попробуйте другой запрос или категорию</p>
            {(query || activeCategory !== 'Все') && (
              <button
                onClick={() => { haptic.tap(); setSearchQuery(''); handleCategoryChange('Все'); }}
                className="rounded-xl bg-pastel-ivory px-5 py-2.5 text-sm font-bold text-text-main"
              >
                Сбросить фильтры
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
