import { useLocation, useNavigate } from 'react-router-dom';
import { WebApp } from '../utils/telegram';
import { motion } from 'framer-motion';
import { useCartStore } from '../store/useCartStore';
import { useUserStore } from '../store/useUserStore';

const ALL_TABS = [
  { path: '/', icon: 'home', label: 'Главная' },
  { path: '/catalog', icon: 'grid_view', label: 'Каталог' },
  { path: '/cart', icon: 'shopping_bag', label: 'Корзина' },
  { path: '/orders', icon: 'receipt_long', label: 'Заказы' },
  { path: '/admin', icon: 'admin_panel_settings', label: 'Админ', adminOnly: true },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartCount = useCartStore((s) => s.getItemCount());
  const isAdmin = useUserStore((s) => s.isAdmin);
  
  const tabs = ALL_TABS.filter(t => !t.adminOnly || isAdmin);

  // Hide on product detail page
  if (location.pathname.startsWith('/product/') || location.pathname === '/admin') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-auto max-w-lg">
        <div className="mx-3 mb-3 flex items-center justify-around rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 px-2 py-2 shadow-[0_-4px_30px_rgba(0,0,0,0.08)]">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => {
                  if (WebApp.initData) WebApp.HapticFeedback.impactOccurred('light');
                  navigate(tab.path);
                }}
                className="relative flex flex-col items-center gap-0.5 px-4 py-1.5 transition-all"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-xl bg-primary/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={`material-symbols-outlined relative z-10 text-[22px] transition-colors ${
                    isActive ? 'text-primary' : 'text-text-sub'
                  }`}
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {tab.icon}
                </span>
                {tab.path === '/cart' && cartCount > 0 && (
                  <motion.span
                    className="absolute -right-0.5 top-0 z-20 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    {cartCount}
                  </motion.span>
                )}
                <span
                  className={`relative z-10 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-text-sub'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
