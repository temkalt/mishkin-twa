import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
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

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Initialize Telegram Web App
    if (WebApp.initData) {
      WebApp.ready();
      WebApp.expand();
      // Setup theme based on TG
      if (WebApp.colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }

    // Authenticate user with backend
    api.post<UserAuth>('/users/auth', {}).catch((err) => {
      console.warn('Auth failed (ok in dev without server):', err.message);
    });
  }, []);

  return (
    <div className="min-h-screen w-full relative bg-background-light dark:bg-background-dark text-text-main dark:text-pastel-ivory overflow-hidden">
      <AnimatePresence mode="wait">
        {showSplash && (
          <Splash key="splash" onComplete={() => setShowSplash(false)} />
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
