import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../utils/haptics';
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

  const tabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);

  // Hide on product detail and admin page
  if (location.pathname.startsWith('/product/') || location.pathname === '/admin') {
    return null;
  }

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
    >
      <div className="mx-auto max-w-lg">
        <div className="mx-3 mb-3 flex items-center justify-around rounded-2xl glass-nav border border-white/30 px-2 py-2 shadow-[0_-4px_30px_rgba(0,0,0,0.08)]">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => {
                  if (isActive) return;
                  haptic.select();
                  navigate(tab.path);
                }}
                className="relative flex flex-col items-center gap-0.5 px-4 py-1.5"
              >
                {/* Active background pill */}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-xl bg-primary/10 shadow-glow"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                {/* Icon */}
                <div className="relative">
                  <motion.span
                    className={`material-symbols-outlined relative z-10 text-[22px] transition-colors ${
                      isActive ? 'text-primary' : 'text-text-sub'
                    }`}
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                    animate={{ scale: isActive ? [1, 1.3, 1.15] : 1, y: isActive ? [-3, 0] : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    {tab.icon}
                  </motion.span>

                  {/* Cart badge */}
                  {tab.path === '/cart' && cartCount > 0 && (
                    <AnimatePresence>
                      <motion.span
                        key={cartCount}
                        className="absolute -right-2 -top-1 z-20 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white"
                        initial={{ scale: 0, rotate: -15 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                      >
                        {cartCount > 9 ? '9+' : cartCount}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </div>

                {/* Label */}
                <motion.span
                  className={`relative z-10 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-text-sub'
                  }`}
                  animate={{ opacity: isActive ? 1 : 0.75 }}
                >
                  {tab.label}
                </motion.span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
