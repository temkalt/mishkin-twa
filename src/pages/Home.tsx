import { useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '../store/useProductStore';
import { haptic } from '../utils/haptics';
import { Reveal } from '../components/Reveal';
import { Icon, type IconName } from '../components/Icon';
import { fadeUp, staggerContainer, spring, EASE_OUT } from '../utils/motion';

const money = (value: number) => value.toLocaleString('ru-RU');

const ADVANTAGES: Array<{ icon: IconName; title: string; desc: string }> = [
  { icon: 'palette', title: 'Ручная работа', desc: 'Каждое изделие уникально' },
  { icon: 'leaf', title: 'Натуральные основы', desc: 'Экологичные материалы' },
  { icon: 'shipping', title: 'Доставка', desc: 'По всей России' },
  { icon: 'sparkles', title: 'С душой', desc: 'Внимание к каждой детали' },
];

function SkeletonCard() {
  return (
    <div className="flex min-w-[155px] flex-shrink-0 flex-col gap-2">
      <div className="skeleton aspect-[3/4] w-full rounded-2xl" />
      <div className="flex flex-col gap-1.5 px-1">
        <div className="skeleton h-3 w-20 rounded-lg" />
        <div className="skeleton h-4 w-14 rounded-lg" />
      </div>
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const { featured, fetchFeatured, products, fetchProducts, isLoading, error } = useProductStore();

  const { scrollY } = useScroll();
  const heroTextY = useTransform(scrollY, [0, 320], [0, 70]);
  const heroDim = useTransform(scrollY, [0, 260], [0, 0.4]);

  useEffect(() => {
    void fetchFeatured();
    void fetchProducts();
  }, [fetchFeatured, fetchProducts]);

  const heroProduct = featured[0];
  const bestsellers = featured.length > 0 ? featured : products.slice(0, 4);
  const limited = products.filter((p) => p.category === 'Лимитированные');
  const nothingLoaded = !isLoading && products.length === 0 && featured.length === 0;

  return (
    <motion.div
      className="mesh-bg grain flex min-h-screen flex-col pb-nav-safe"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ===== ШАПКА ===== */}
      <motion.header
        className="glass-nav sticky top-0 z-header flex items-center justify-between px-5 pb-4 pt-[calc(var(--app-top)+1rem)]"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.4, ease: EASE_OUT }}
      >
        <div className="flex items-center gap-2.5">
          <motion.img
            src="/images/logo123.png"
            alt=""
            className="size-8 rounded-lg object-cover shadow-soft"
            initial={{ rotate: -15, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}
          />
          <h1 className="text-gradient font-display text-xl font-bold uppercase tracking-[0.14em]">
            Mishkin
          </h1>
        </div>
        <motion.button
          onClick={() => { haptic.press(); navigate('/catalog', { state: { openSearch: true } }); }}
          aria-label="Поиск по каталогу"
          className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory/80 transition-colors active:bg-pastel-sand/60"
          whileTap={{ scale: 0.85 }}
        >
          <Icon name="search" />
        </motion.button>
      </motion.header>

      {/* ===== ОШИБКА ЗАГРУЗКИ ===== */}
      {nothingLoaded && (
        <div className="mx-4 mt-6 card p-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-danger/10">
            <Icon name="alert" size={22} className="text-danger" />
          </div>
          <h3 className="mb-1 font-display text-base font-bold text-text-main">Магазин не загрузился</h3>
          <p className="mb-4 text-xs text-text-sub">
            {error || 'Проверьте соединение и попробуйте снова.'}
          </p>
          <button
            onClick={() => { haptic.tap(); void fetchProducts('Все', true); void fetchFeatured(true); }}
            className="text-xs font-bold text-primary underline"
          >
            Повторить
          </button>
        </div>
      )}

      {/* ===== ГЕРОЙ ===== */}
      <motion.section className="mx-4 mb-8 mt-4" variants={fadeUp} initial="hidden" animate="visible">
        <motion.div
          className="relative h-[300px] w-full cursor-pointer overflow-hidden rounded-3xl shadow-lift"
          onClick={() => {
            if (!heroProduct) return;
            haptic.press();
            navigate(`/product/${heroProduct.id}`, { state: { layoutIdPrefix: 'hero' } });
          }}
          whileTap={{ scale: 0.985 }}
          transition={spring.snappy}
        >
          {heroProduct ? (
            <>
              <motion.img
                layoutId={`hero-${heroProduct.id}`}
                src={heroProduct.images[0]}
                alt={heroProduct.name}
                className="h-full w-full object-cover"
                animate={{ scale: [1.08, 1] }}
                transition={{ duration: 6, ease: EASE_OUT }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <motion.div className="absolute inset-0 bg-black" style={{ opacity: heroDim }} />
              <span className="sheen opacity-40" />

              <motion.div className="absolute bottom-5 left-5 right-5 text-white" style={{ y: heroTextY }}>
                <motion.span
                  className="mb-1.5 inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur-md"
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
                  transition={{ delay: 0.42, ease: EASE_OUT }}
                >
                  {heroProduct.name}
                </motion.h2>
                <motion.p
                  className="mt-1 text-sm tabular-nums text-white/85"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.52 }}
                >
                  {money(heroProduct.price)} ₽
                </motion.p>
              </motion.div>
            </>
          ) : (
            <div className="skeleton h-full w-full rounded-3xl" />
          )}
        </motion.div>
      </motion.section>

      {/* ===== ПОПУЛЯРНЫЕ ===== */}
      {(isLoading || bestsellers.length > 0) && (
        <section className="mb-8">
          <motion.div
            className="mb-4 flex items-center justify-between px-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4, ease: EASE_OUT }}
          >
            <h3 className="font-display text-lg font-bold text-text-main">Популярные товары</h3>
            <button
              onClick={() => { haptic.tap(); navigate('/catalog'); }}
              className="text-xs font-semibold uppercase tracking-wider text-primary active:opacity-60"
            >
              Все →
            </button>
          </motion.div>

          <div className="h-scroll gap-3 px-5 pb-3">
            {isLoading && bestsellers.length === 0 ? (
              [1, 2, 3].map((i) => <SkeletonCard key={i} />)
            ) : (
              <motion.div
                className="flex gap-3"
                variants={staggerContainer(0.07)}
                initial="hidden"
                animate="visible"
              >
                {bestsellers.map((product) => (
                  <motion.div
                    key={product.id}
                    className="flex min-w-[155px] max-w-[155px] flex-shrink-0 cursor-pointer flex-col gap-2"
                    onClick={() => {
                      haptic.tap();
                      navigate(`/product/${product.id}`, { state: { layoutIdPrefix: 'bestseller' } });
                    }}
                    variants={fadeUp}
                    whileTap={{ scale: 0.93 }}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-pastel-sand/30 shadow-soft">
                      <motion.img
                        layoutId={`bestseller-${product.id}`}
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {product.isFeatured && (
                        <span className="absolute left-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                          Хит
                        </span>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent" />
                    </div>
                    <div className="px-0.5">
                      <h4 className="line-clamp-1 text-sm font-bold text-text-main">{product.name}</h4>
                      <p className="text-xs font-semibold tabular-nums text-primary">{money(product.price)} ₽</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>
      )}

      {/* ===== ОСОБАЯ КОЛЛЕКЦИЯ ===== */}
      {limited.length > 0 && (
        <motion.section
          className="mx-4 mb-8"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="animate-float text-accent-deep">
              <Icon name="diamond" size={17} />
            </span>
            <h3 className="font-display text-lg font-bold text-text-main">Особая коллекция</h3>
          </div>

          <motion.div
            className="flex flex-col gap-3"
            variants={staggerContainer(0.08)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-30px' }}
          >
            {limited.map((p) => (
              <motion.div
                key={p.id}
                className="flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-pastel-ivory to-pastel-sand/30 p-3 shadow-soft"
                onClick={() => { haptic.tap(); navigate(`/product/${p.id}`, { state: { layoutIdPrefix: 'limited' } }); }}
                variants={fadeUp}
                whileTap={{ scale: 0.96 }}
              >
                <div className="size-20 flex-shrink-0 overflow-hidden rounded-xl">
                  <motion.img
                    layoutId={`limited-${p.id}`}
                    src={p.images[0]}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-deep">
                    Эксклюзив
                  </span>
                  <h4 className="truncate text-sm font-bold text-text-main">{p.name}</h4>
                  <p className="line-clamp-1 text-xs text-text-sub">{p.description}</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-primary">{money(p.price)} ₽</p>
                </div>
                <span className="text-text-sub">
                  <Icon name="chevron_right" size={18} />
                </span>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* ===== О НАС ===== */}
      <Reveal className="mx-4 mb-8 overflow-hidden rounded-3xl shadow-soft">
        <div className="relative h-48 w-full">
          <img src="/images/about_.jpg" alt="" className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background-light via-background-light/60 to-transparent" />
        </div>
        <div className="relative z-10 -mt-12 px-5 pb-6">
          <span className="mb-2 inline-block text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            О нас
          </span>
          <h3 className="mb-2 font-display text-xl font-bold text-text-main">Искусство создания уюта</h3>
          <p className="text-sm leading-relaxed text-text-sub">
            Мы все делаем сами и вкладываем душу в наш продукт. Создаем авторские
            предметы декора и интерьерные изделия ручной работы, которые наполняют
            ваш дом теплом, гармонией и уникальной атмосферой.
          </p>
        </div>
      </Reveal>

      {/* ===== ПРЕИМУЩЕСТВА ===== */}
      <motion.section
        className="mx-4 mb-8"
        variants={staggerContainer(0.08)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        <div className="grid grid-cols-2 gap-3">
          {ADVANTAGES.map((item) => (
            <motion.div
              key={item.title}
              className="flex flex-col items-center gap-2 rounded-2xl bg-pastel-ivory/60 p-4 text-center shadow-soft"
              variants={fadeUp}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name={item.icon} size={20} />
              </div>
              <h4 className="text-xs font-bold text-text-main">{item.title}</h4>
              <p className="text-[11px] leading-tight text-text-sub">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ===== ПОДВАЛ ===== */}
      <Reveal className="mx-4 mb-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line/60 bg-surface/60 px-5 py-5 text-center">
          <p className="text-xs text-text-sub">Вопросы по заказу — напишите нам в Telegram</p>
          <button
            onClick={() => { haptic.tap(); navigate('/legal'); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary"
          >
            <Icon name="receipt_long" size={14} />
            Оферта и обработка данных
          </button>
        </div>
      </Reveal>
    </motion.div>
  );
}
