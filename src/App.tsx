import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { getWebApp } from './utils/telegram';
import { Splash } from './components/Splash';
import { SubscriptionPopup } from './components/SubscriptionPopup';
import { BottomNav } from './components/BottomNav';
import { api } from './utils/api';

const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Catalog = lazy(() => import('./pages/Catalog').then(m => ({ default: m.Catalog })));
const Product = lazy(() => import('./pages/Product').then(m => ({ default: m.Product })));
const Cart = lazy(() => import('./pages/Cart').then(m => ({ default: m.Cart })));
const Orders = lazy(() => import('./pages/Orders').then(m => ({ default: m.Orders })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
import type { UserAuth } from './utils/types';
import { useUserStore } from './store/useUserStore';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Initialize Telegram Web App
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

    // Authenticate user FIRST — so admin status is ready before UI renders
    api.post<UserAuth>('/users/auth', {}).then((data) => {
      console.log('[Auth] Response:', JSON.stringify(data));
      if (data.isAdmin) {
        console.log('[Auth] Admin granted for ID:', data.telegramId);
        useUserStore.getState().setAdmin(true);
      }
    }).catch((err) => {
      console.warn('[Auth] Failed:', err.message);
    }).finally(() => {
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (getWebApp()?.initData) {
      const webApp = getWebApp();
      const handleBack = () => window.history.back();
      
      if (['/', '/catalog', '/cart', '/orders', '/admin'].includes(location.pathname)) {
        webApp.BackButton.hide();
        webApp.offEvent('backButtonClicked', handleBack);
      } else {
        webApp.BackButton.show();
        webApp.onEvent('backButtonClicked', handleBack);
      }
      return () => {
        webApp.offEvent('backButtonClicked', handleBack);
      }
    }
  }, [location.pathname]);

  // Splash calls this when animation is done.
  // We wait up to 3 extra seconds for auth, then proceed.
  const handleSplashComplete = () => {
    if (authReady) {
      setShowSplash(false);
      return;
    }
    let waited = 0;
    const interval = setInterval(() => {
      waited += 100;
      if (useUserStore.getState() !== null || waited >= 3000) {
        clearInterval(interval);
        setShowSplash(false);
      }
    }, 100);
    setTimeout(() => {
      clearInterval(interval);
      setShowSplash(false);
    }, 3000);
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
          <AnimatePresence mode="wait">
            <Suspense fallback={
              <div className="flex h-screen items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="size-10 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
              </div>
            }>
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Home />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/product/:id" element={<Product />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </Suspense>
          </AnimatePresence>
          <BottomNav />
        </>
      )}
    </div>
  );
}

export default App;
