import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProductStore } from '../store/useProductStore';
import { useCartStore } from '../store/useCartStore';

function SkeletonCard() {
  return (
    <div className="min-w-[160px] flex-shrink-0 flex flex-col gap-2 animate-pulse">
      <div className="h-48 w-full rounded-xl bg-pastel-sand/50 p-4">
        <div className="h-full w-full rounded-lg bg-pastel-ivory" />
      </div>
      <div className="px-1">
        <div className="h-4 w-24 rounded bg-pastel-sand/60 mb-1" />
        <div className="h-3 w-16 rounded bg-pastel-sand/40" />
      </div>
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const { featured, fetchFeatured, products, fetchProducts, isLoading } = useProductStore();
  const cartItemCount = useCartStore((s) => s.getItemCount());

  useEffect(() => {
    fetchFeatured();
    fetchProducts();
  }, [fetchFeatured, fetchProducts]);

  // Берём первый featured товар для Hero
  const heroProduct = featured[0];
  // Для секции "Бестселлеры" берём featured
  const bestsellers = featured.length > 0 ? featured : products.slice(0, 3);

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background-light pb-20 pt-6 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <header className="mb-8 flex items-center justify-between">
        <h2 className="font-bahnschrift text-2xl font-bold tracking-wide uppercase text-text-main">
          Mishkin
        </h2>
        <div className="flex gap-3 text-text-main">
           <button 
              onClick={() => navigate('/catalog')}
              className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90"
           >
              <span className="material-symbols-outlined">search</span>
           </button>
           <button 
              onClick={() => navigate('/cart')}
              className="flex size-10 items-center justify-center rounded-full bg-pastel-ivory transition-transform active:scale-90 relative"
           >
              <span className="material-symbols-outlined">shopping_bag</span>
              {cartItemCount > 0 && (
                <motion.span 
                  className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {cartItemCount}
                </motion.span>
              )}
           </button>
        </div>
      </header>

      <section className="mb-10">
        <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-pastel-sand">
          {heroProduct ? (
            <>
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-80" 
                style={{ backgroundImage: `url(${heroProduct.images[0]})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
              <motion.div 
                className="absolute bottom-4 left-4 right-4 text-white cursor-pointer"
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/product/${heroProduct.id}`)}
              >
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-accent">Новинка</span>
                <h3 className="font-bahnschrift text-3xl font-bold">{heroProduct.name}</h3>
                <p className="mt-1 text-sm text-white/80">{heroProduct.price.toLocaleString('ru-RU')} ₽</p>
              </motion.div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-pastel-sand animate-pulse" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="h-3 w-16 rounded bg-white/30 mb-2" />
                <div className="h-8 w-40 rounded bg-white/30" />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bahnschrift text-xl font-bold text-text-main">Бестселлеры</h3>
          <button onClick={() => navigate('/catalog')} className="text-sm font-medium text-text-sub">Смотреть все</button>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {isLoading ? (
            [1, 2, 3].map((i) => <SkeletonCard key={i} />)
          ) : (
            bestsellers.map((product) => (
              <motion.div 
                key={product.id}
                className="min-w-[160px] flex-shrink-0 flex flex-col gap-2"
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <div className="relative h-48 w-full overflow-hidden rounded-xl bg-pastel-sand/50">
                  {product.images[0] ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full rounded-lg bg-pastel-ivory shadow-sm" />
                  )}
                </div>
                <div className="px-1">
                  <h4 className="font-bold text-text-main line-clamp-1">{product.name}</h4>
                  <p className="text-sm text-text-sub">{product.price.toLocaleString('ru-RU')} ₽</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* About section */}
      <motion.section 
        className="mb-8 rounded-2xl bg-pastel-ivory/70 p-6"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ type: "spring", damping: 25, stiffness: 150 }}
      >
        <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">О нас</span>
        <h3 className="mb-3 font-bahnschrift text-xl font-bold text-text-main">Slow Living Art</h3>
        <p className="text-sm leading-relaxed text-text-sub">
          Каждая свеча MISHKIN — это медитация ручного труда. Мы отбираем лучший соевый воск, 
          смешиваем его с эфирными маслами от фермеров Прованса и создаём ароматы, 
          которые превращают ваш дом в место абсолютного покоя.
        </p>
      </motion.section>
    </motion.div>
  );
}
