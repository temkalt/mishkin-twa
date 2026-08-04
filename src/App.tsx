import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { getWebApp } from './utils/telegram';
import { Splash } from './components/Splash';
import { SubscriptionPopup } from './components/SubscriptionPopup';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { Product } from './pages/Product';
import { Cart } from './pages/Cart';
import { Orders } from './pages/Orders';
import { Admin } from './pages/Admin';
import { api } from './utils/api';
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
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Home />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/product/:id" element={<Product />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </AnimatePresence>
          <BottomNav />
        </>
      )}
    </div>
  );
}

export default App;
