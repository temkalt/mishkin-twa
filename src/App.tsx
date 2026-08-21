import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getWebApp, isInTelegram } from './utils/telegram';
import { Splash } from './components/Splash';
import { SubscriptionPopup } from './components/SubscriptionPopup';
import { BottomNav } from './components/BottomNav';
import { api } from './utils/api';
import type { UserAuth } from './utils/types';
import { useUserStore } from './store/useUserStore';
import { useShopConfig } from './store/useShopConfig';

const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Catalog = lazy(() => import('./pages/Catalog').then(m => ({ default: m.Catalog })));
const Product = lazy(() => import('./pages/Product').then(m => ({ default: m.Product })));
const Cart = lazy(() => import('./pages/Cart').then(m => ({ default: m.Cart })));
const Checkout = lazy(() => import('./pages/Checkout').then(m => ({ default: m.Checkout })));
const OrderResult = lazy(() => import('./pages/OrderResult').then(m => ({ default: m.OrderResult })));
const Orders = lazy(() => import('./pages/Orders').then(m => ({ default: m.Orders })));
const Legal = lazy(() => import('./pages/Legal').then(m => ({ default: m.Legal })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));

// Верхний уровень навигации: здесь Telegram-кнопка «назад» не нужна.
const TOP_LEVEL_ROUTES = ['/', '/catalog', '/cart', '/orders', '/admin'];

// Инлайновый фолбэк для React.lazy: полноэкранный сплэш между роутами мигал бы
// на каждом переходе, поэтому здесь только три точки внизу и задержка 0.15 с —
// при быстрой загрузке чанка пользователь не видит вообще ничего.
function PageFallback() {
  return (
    <div className="flex min-h-screen items-end justify-center bg-background-light pb-32">
      <motion.div
        className="flex gap-1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="size-2 rounded-full bg-primary/40"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </motion.div>
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Инициализация Telegram живёт в main.tsx — здесь только авторизация.
    api.post<UserAuth>('/users/auth', {})
      .then((data) => {
        if (data.isAdmin) useUserStore.getState().setAdmin(true);
      })
      .catch(() => {
        // Молча: без авторизации пользователь просто не получит админку.
      })
      .finally(() => setAuthReady(true));

    // Настройки магазина нужны и корзине, и чекауту — тянем заранее.
    void useShopConfig.getState().load();
  }, []);

  // Диплинки приходят четырьмя разными путями, и все четыре реально встречаются:
  // start_param в initDataUnsafe (запуск из бота/канала), tgWebAppStartParam или
  // startapp в query (Telegram кладёт параметр туда при открытии по прямой ссылке),
  // и наши собственные ?paid=/?product= — ими возвращается внешний браузер после
  // страницы ЮKassa, где никакого Telegram-контекста уже нет.
  useEffect(() => {
    if (showSplash) return;

    const startParam = getWebApp()?.initDataUnsafe?.start_param;
    if (startParam) {
      const paidMatch = startParam.match(/^paid-(\d+)$/);
      if (paidMatch) {
        navigate(`/order/${paidMatch[1]}`, { replace: true });
        return;
      }
      const prodMatch = startParam.match(/^(?:product_|p_|prod_)?(\d+)$/);
      if (prodMatch) {
        navigate(`/product/${prodMatch[1]}`, { replace: true });
        return;
      }
    }

    const params = new URLSearchParams(window.location.search);
    const tgParam = params.get('tgWebAppStartParam') || params.get('startapp');
    if (tgParam) {
      const paidMatch = tgParam.match(/^paid-(\d+)$/);
      if (paidMatch) {
        navigate(`/order/${paidMatch[1]}`, { replace: true });
        return;
      }
      const prodMatch = tgParam.match(/^(?:product_|p_|prod_)?(\d+)$/);
      if (prodMatch) {
        navigate(`/product/${prodMatch[1]}`, { replace: true });
        return;
      }
    }

    const paid = params.get('paid');
    if (paid && /^\d+$/.test(paid)) {
      navigate(`/order/${paid}`, { replace: true });
      return;
    }

    const product = params.get('product');
    if (product && /^\d+$/.test(product)) {
      navigate(`/product/${product}`, { replace: true });
      return;
    }
  }, [showSplash, navigate]);

  // Системную кнопку «назад» Telegram показываем только на вложенных экранах:
  // на верхнем уровне она уводила бы из приложения. offEvent в cleanup обязателен —
  // WebApp живёт вне React, и без него на каждый переход накапливался бы лишний
  // обработчик, а один клик прокручивал историю на несколько шагов назад.
  useEffect(() => {
    const webApp = getWebApp();
    if (!isInTelegram() || !webApp) return;

    const handleBack = () => window.history.back();

    if (TOP_LEVEL_ROUTES.includes(location.pathname)) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
      webApp.onEvent('backButtonClicked', handleBack);
    }
    return () => {
      webApp.offEvent('backButtonClicked', handleBack);
    };
  }, [location.pathname]);

  const handleSplashComplete = () => {
    if (authReady) {
      setShowSplash(false);
      return;
    }
    // Ждём авторизацию, но не дольше 2.5 с — иначе сплэш «залипает».
    const timeout = setTimeout(() => setShowSplash(false), 2500);
    const poll = setInterval(() => {
      if (authReady) {
        clearInterval(poll);
        clearTimeout(timeout);
        setShowSplash(false);
      }
    }, 80);
    return () => { clearInterval(poll); clearTimeout(timeout); };
  };

  // Страница товара выезжает снизу, остальные — растворяются.
  const isProductPage = location.pathname.startsWith('/product/');
  const pageVariants = {
    initial: isProductPage ? { opacity: 0, y: 30 } : { opacity: 0 },
    animate: { opacity: 1, y: 0 },
    exit: isProductPage ? { opacity: 0, y: 20 } : { opacity: 0 },
  };

  return (
    // overflow-x-clip, а не overflow-hidden: hidden делает контейнер скролл-портом,
    // и все sticky-шапки (главная, каталог, заказы, админка) перестают липнуть —
    // уезжают вверх вместе с контентом. clip обрезает горизонтальный выезд
    // страниц при переходе, но скролл-порт не создаёт.
    <div className="relative min-h-screen w-full overflow-x-clip bg-background-light text-text-main">
      <AnimatePresence mode="wait">
        {showSplash && <Splash key="splash" onComplete={handleSplashComplete} />}
      </AnimatePresence>

      {!showSplash && (
        <>
          <SubscriptionPopup />
          <Suspense fallback={<PageFallback />}>
            {/* mode="wait", а не "popLayout": popLayout оставлял уходящую
                страницу в потоке с position: absolute, и полсекунды после
                перехода тапы попадали в неё, а не в новый экран. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <Routes location={location}>
                  <Route path="/" element={<Home />} />
                  <Route path="/catalog" element={<Catalog />} />
                  <Route path="/product/:id" element={<Product />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/order/:id" element={<OrderResult />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/legal" element={<Legal />} />
                  <Route path="/admin" element={<Admin />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </Suspense>
          <BottomNav />
        </>
      )}
    </div>
  );
}

export default App;
