import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '../store/useProductStore';

// Stagger container
const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 220, damping: 22 },
  },
};

function SkeletonCard() {
  return (
    <div className="min-w-[155px] flex-shrink-0 flex flex-col gap-2">
      <div className="skeleton aspect-[3/4] w-full rounded-2xl" />
      <div className="px-1 flex flex-col gap-1.5">
        <div className="skeleton h-3 w-20 rounded-lg" />
        <div className="skeleton h-4 w-14 rounded-lg" />
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
      transition={{ duration: 0.25 }}
    >
      {/* ===== HEADER ===== */}
      <motion.header
        className="sticky top-0 z-40 flex items-center justify-between px-5 py-4 glass-nav"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2.5">
          <motion.img
            src="/images/logo123.png"
            alt="Mishkin"
            className="h-8 w-8 rounded-lg object-cover"
            initial={{ rotate: -15, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}
          />
          <h1 className="font-display text-xl font-bold tracking-wide uppercase text-text-main">
            Mishkin
          </h1>
        </div>
        <motion.button
          onClick={() => navigate('/catalog')}
          className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80 transition-colors hover:bg-pastel-sand/60"
          whileTap={{ scale: 0.85 }}
        >
          <span className="material-symbols-outlined text-text-main text-[20px]">search</span>
        </motion.button>
      </motion.header>

      {/* ===== HERO BANNER ===== */}
      <motion.section
        className="mx-4 mb-8"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="relative h-[280px] w-full overflow-hidden rounded-3xl cursor-pointer"
          onClick={() => heroProduct && navigate(`/product/${heroProduct.id}`, { state: { layoutIdPrefix: 'hero' } })}
          whileTap={{ scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          {heroProduct ? (
            <>
              <motion.img
                layoutId={`hero-${heroProduct.id}`}
                src={heroProduct.images[0]}
                alt={heroProduct.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <motion.span
                  className="mb-1.5 inline-block rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  Новинка сезона
                </motion.span>
                <motion.h2
                  className="font-display text-2xl font-bold leading-tight"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                  {heroProduct.name}
                </motion.h2>
                <motion.p
                  className="mt-1 text-sm text-white/70"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.52 }}
                >
                  {heroProduct.price.toLocaleString('ru-RU')} ₽
                </motion.p>
              </div>
            </>
          ) : (
            <div className="skeleton h-full w-full rounded-3xl" />
          )}
        </motion.div>
      </motion.section>

      {/* ===== БЕСТСЕЛЛЕРЫ ===== */}
      <section className="mb-8">
        <motion.div
          className="mb-4 flex items-center justify-between px-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h3 className="font-display text-lg font-bold text-text-main">Популярные ароматы</h3>
          <button
            onClick={() => navigate('/catalog')}
            className="text-xs font-semibold text-primary uppercase tracking-wider"
          >
            Все →
          </button>
        </motion.div>

        <div className="flex gap-3 overflow-x-auto px-5 pb-3 no-scrollbar">
          {isLoading
            ? [1, 2, 3].map((i) => <SkeletonCard key={i} />)
            : (
              <motion.div
                className="flex gap-3"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {bestsellers.map((product) => (
                  <motion.div
                    key={product.id}
                    className="min-w-[155px] max-w-[155px] flex-shrink-0 flex flex-col gap-2 cursor-pointer"
                    onClick={() => navigate(`/product/${product.id}`, { state: { layoutIdPrefix: 'bestseller' } })}
                    variants={fadeUp}
                    whileTap={{ scale: 0.93 }}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-pastel-sand/30">
                      <motion.img
                        layoutId={`bestseller-${product.id}`}
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {product.isFeatured && (
                        <span className="absolute top-2 left-2 rounded-full bg-primary/90 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                          Hit
                        </span>
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-2xl" />
                    </div>
                    <div className="px-0.5">
                      <h4 className="text-sm font-bold text-text-main line-clamp-1">{product.name}</h4>
                      <p className="text-xs font-semibold text-primary">
                        {product.price.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
        </div>
      </section>

      {/* ===== ЛИМИТИРОВАННАЯ КОЛЛЕКЦИЯ ===== */}
      {limited.length > 0 && (
        <motion.section
          className="mx-4 mb-8"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-accent text-[18px]">diamond</span>
            <h3 className="font-display text-lg font-bold text-text-main">Лимитированная коллекция</h3>
          </div>

          <motion.div
            className="flex flex-col gap-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-30px' }}
          >
            {limited.map((p) => (
              <motion.div
                key={p.id}
                className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-pastel-ivory to-pastel-sand/30 p-3 cursor-pointer overflow-hidden"
                onClick={() => navigate(`/product/${p.id}`, { state: { layoutIdPrefix: 'limited' } })}
                variants={fadeUp}
                whileTap={{ scale: 0.96 }}
              >
                <div className="size-20 flex-shrink-0 overflow-hidden rounded-xl">
                  <motion.img
                    layoutId={`limited-${p.id}`}
                    src={p.images[0]}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-accent">
                    Лимитированная
                  </span>
                  <h4 className="text-sm font-bold text-text-main truncate">{p.name}</h4>
                  <p className="text-xs text-text-sub line-clamp-1">{p.description}</p>
                  <p className="mt-1 text-sm font-bold text-primary">
                    {p.price.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                <span className="material-symbols-outlined text-text-sub text-[18px]">
                  chevron_right
                </span>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* ===== О НАС ===== */}
      <motion.section
        className="mx-4 mb-8 overflow-hidden rounded-3xl"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        <div className="relative h-48 w-full">
          <img
            src="/images/about_.jpg"
            alt="О MISHKIN"
            className="h-full w-full object-cover"
            loading="lazy"
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
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: 'palette', title: 'Ручная работа', desc: 'Каждая уникальна' },
            { icon: 'local_shipping', title: 'Доставка', desc: 'По всей России' },
          ].map((item) => (
            <motion.div
              key={item.title}
              className="flex flex-col items-center gap-2 rounded-2xl bg-pastel-ivory/60 p-4 text-center"
              variants={fadeUp}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <span className="material-symbols-outlined text-primary text-[22px]">{item.icon}</span>
              </div>
              <h4 className="text-xs font-bold text-text-main">{item.title}</h4>
              <p className="text-[10px] text-text-sub">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
