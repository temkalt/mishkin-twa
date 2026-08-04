import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '../store/useProductStore';

const fadeUp = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

function SkeletonCard() {
  return (
    <div className="min-w-[155px] flex-shrink-0 flex flex-col gap-2 animate-pulse">
      <div className="aspect-[3/4] w-full rounded-2xl bg-pastel-sand/50" />
      <div className="px-1">
        <div className="h-3 w-20 rounded bg-pastel-sand/60 mb-1" />
        <div className="h-4 w-16 rounded bg-pastel-sand/40" />
      </div>
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const { featured, fetchFeatured, products, fetchProducts, isLoading } = useProductStore();

  useEffect(() => {
    fetchFeatured();
    fetchProducts();
  }, [fetchFeatured, fetchProducts]);

  const heroProduct = featured[0];
  const bestsellers = featured.length > 0 ? featured : products.slice(0, 4);
  const limited = products.filter((p) => p.category === 'Лимитированные');

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-4 bg-background-light/80 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <img src="/images/logo123.png" alt="Mishkin" className="h-8 w-8 rounded-lg object-cover" />
          <h1 className="font-display text-xl font-bold tracking-wide uppercase text-text-main">
            Mishkin
          </h1>
        </div>
        <button
          onClick={() => navigate('/catalog')}
          className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80 transition-all active:scale-90 hover:bg-pastel-sand/60"
        >
          <span className="material-symbols-outlined text-text-main text-[20px]">search</span>
        </button>
      </header>

      {/* ===== HERO BANNER ===== */}
      <motion.section
        className="mx-4 mb-8"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div
          className="relative h-[280px] w-full overflow-hidden rounded-3xl cursor-pointer"
          onClick={() => heroProduct && navigate(`/product/${heroProduct.id}`)}
        >
          {heroProduct ? (
            <>
              <img
                src={heroProduct.images[0]}
                alt={heroProduct.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <span className="mb-1.5 inline-block rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                  Новинка сезона
                </span>
                <h2 className="font-display text-2xl font-bold leading-tight">{heroProduct.name}</h2>
                <p className="mt-1 text-sm text-white/70">
                  {heroProduct.price.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </>
          ) : (
            <div className="h-full w-full animate-pulse bg-pastel-sand/50 rounded-3xl" />
          )}
        </div>
      </motion.section>

      {/* ===== БЕСТСЕЛЛЕРЫ ===== */}
      <motion.section
        className="mb-8"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="mb-4 flex items-center justify-between px-5">
          <h3 className="font-display text-lg font-bold text-text-main">Популярные ароматы</h3>
          <button
            onClick={() => navigate('/catalog')}
            className="text-xs font-semibold text-primary uppercase tracking-wider"
          >
            Все →
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto px-5 pb-3 no-scrollbar">
          {isLoading
            ? [1, 2, 3].map((i) => <SkeletonCard key={i} />)
            : bestsellers.map((product, idx) => (
                <motion.div
                  key={product.id}
                  className="min-w-[155px] max-w-[155px] flex-shrink-0 flex flex-col gap-2 cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  whileInView={{ opacity: 1, x: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ delay: idx * 0.1, type: 'spring', stiffness: 250, damping: 22 }}
                  whileTap={{ scale: 0.92 }}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-pastel-sand/30">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                    {product.isFeatured && (
                      <span className="absolute top-2 left-2 rounded-full bg-primary/90 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                        Hit
                      </span>
                    )}
                  </div>
                  <div className="px-0.5">
                    <h4 className="text-sm font-bold text-text-main line-clamp-1">{product.name}</h4>
                    <p className="text-xs font-medium text-text-sub">
                      {product.price.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                </motion.div>
              ))}
        </div>
      </motion.section>

      {/* ===== ЛИМИТИРОВАННАЯ КОЛЛЕКЦИЯ ===== */}
      {limited.length > 0 && (
        <motion.section
          className="mx-4 mb-8"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 180, damping: 22 }}
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-accent text-[18px]">diamond</span>
            <h3 className="font-display text-lg font-bold text-text-main">Лимитированная коллекция</h3>
          </div>

          <div className="flex flex-col gap-3">
            {limited.map((p, idx) => (
              <motion.div
                key={p.id}
                className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-pastel-ivory to-pastel-sand/30 p-3 cursor-pointer overflow-hidden"
                onClick={() => navigate(`/product/${p.id}`)}
                initial={{ opacity: 0, x: -40, scale: 0.95 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                viewport={{ once: true, margin: '-20px' }}
                transition={{ delay: idx * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="size-20 flex-shrink-0 overflow-hidden rounded-xl">
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-accent">
                    Лимитированная
                  </span>
                  <h4 className="text-sm font-bold text-text-main truncate">{p.name}</h4>
                  <p className="text-xs text-text-sub line-clamp-1">{p.description}</p>
                  <p className="mt-1 text-sm font-bold text-text-main">
                    {p.price.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                <span className="material-symbols-outlined text-text-sub text-[18px]">
                  chevron_right
                </span>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ===== О НАС ===== */}
      <motion.section
        className="mx-4 mb-8 overflow-hidden rounded-3xl"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        transition={{ delay: 0.1, type: 'spring', damping: 25 }}
      >
        <div className="relative h-48 w-full">
          <img
            src="/images/about_.jpg"
            alt="О MISHKIN"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background-light via-background-light/60 to-transparent" />
        </div>
        <div className="-mt-12 relative z-10 px-5 pb-6">
          <span className="mb-2 inline-block text-[10px] font-bold uppercase tracking-widest text-primary">
            О нас
          </span>
          <h3 className="mb-2 font-display text-xl font-bold text-text-main">Искусство создания уюта</h3>
          <p className="text-sm leading-relaxed text-text-sub">
            Каждая свеча MISHKIN — это медитация ручного труда. Мы отбираем лучший соевый воск,
            смешиваем его с эфирными маслами от фермеров Прованса и создаём ароматы, которые
            превращают ваш дом в место абсолютного покоя.
          </p>
        </div>
      </motion.section>

      {/* ===== ПРЕИМУЩЕСТВА ===== */}
      <motion.section
        className="mx-4 mb-8"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        transition={{ delay: 0.1, type: 'spring', damping: 25 }}
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: 'eco', title: '100% натуральный', desc: 'Соевый воск' },
            { icon: 'local_fire_department', title: 'До 60 часов', desc: 'Время горения' },
            { icon: 'palette', title: 'Ручная работа', desc: 'Каждая уникальна' },
            { icon: 'local_shipping', title: 'Доставка', desc: 'По всей России' },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              className="flex flex-col items-center gap-2 rounded-2xl bg-pastel-ivory/60 p-4 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <span className="material-symbols-outlined text-primary text-[24px]">{item.icon}</span>
              <h4 className="text-xs font-bold text-text-main">{item.title}</h4>
              <p className="text-[10px] text-text-sub">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
