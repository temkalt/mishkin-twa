import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { getWebApp } from './utils/telegram';
import { Splash } from './components/Splash';
import { SubscriptionPopup } from './components/SubscriptionPopup';
import { BottomNav } from './components/BottomNav';
import { api } from './utils/api';
import type { UserAuth } from './utils/types';
import { useUserStore } from './store/useUserStore';

const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Catalog = lazy(() => import('./pages/Catalog').then(m => ({ default: m.Catalog })));
const Product = lazy(() => import('./pages/Product').then(m => ({ default: m.Product })));
const Cart = lazy(() => import('./pages/Cart').then(m => ({ default: m.Cart })));
const Orders = lazy(() => import('./pages/Orders').then(m => ({ default: m.Orders })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));

// Minimal inline fallback — avoids spinner flash between route changes
function PageFallback() {
  return (
    <div className="min-h-screen bg-background-light flex items-end justify-center pb-32">
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

  useEffect(() => {
    const webApp = getWebApp();
    if (webApp && webApp.initData) {
      webApp.ready();
      webApp.expand();
      if (webApp.requestFullscreen) {
        webApp.requestFullscreen();
      }
      if (webApp.colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }

    api.post<UserAuth>('/users/auth', {}).then((data) => {
      if (data.isAdmin) {
        useUserStore.getState().setAdmin(true);
      }
    }).catch(() => {
      // silent fail — user just won't have admin
    }).finally(() => {
      setAuthReady(true);
    });
  }, []);

  // Telegram BackButton
  useEffect(() => {
    const webApp = getWebApp();
    if (!webApp?.initData) return;

    const topLevelRoutes = ['/', '/catalog', '/cart', '/orders', '/admin'];
    const handleBack = () => window.history.back();

    if (topLevelRoutes.includes(location.pathname)) {
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
    // Wait for auth, max 2.5s
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

  // Determine slide direction for product pages
  const isProductPage = location.pathname.startsWith('/product/');
  const pageVariants = {
    initial: isProductPage
      ? { opacity: 0, y: 30 }
      : { opacity: 0 },
    animate: { opacity: 1, y: 0 },
    exit: isProductPage
      ? { opacity: 0, y: 20 }
      : { opacity: 0 },
  };

  return (
    <div className="min-h-screen w-full relative bg-background-light dark:bg-background-dark text-text-main dark:text-pastel-ivory overflow-hidden">
      <AnimatePresence mode="wait">
        {showSplash && (
          <Splash key="splash" onComplete={handleSplashComplete} />
        )}
      </AnimatePresence>

      {!showSplash && (
        <>
          <SubscriptionPopup />
          <Suspense fallback={<PageFallback />}>
            <AnimatePresence mode="popLayout" initial={false}>
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
                  <Route path="/orders" element={<Orders />} />
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
