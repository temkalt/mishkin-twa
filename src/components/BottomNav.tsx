import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../utils/haptics';
import { spring } from '../utils/motion';
import { useCartStore } from '../store/useCartStore';
import { useUserStore } from '../store/useUserStore';
import { NavIcon, type NavIconName } from './NavIcon';

const ALL_TABS: Array<{ path: string; icon: NavIconName; label: string; adminOnly?: boolean }> = [
  { path: '/', icon: 'home', label: 'Главная' },
  { path: '/catalog', icon: 'grid', label: 'Каталог' },
  { path: '/cart', icon: 'shopping_bag', label: 'Корзина' },
  { path: '/orders', icon: 'receipt_long', label: 'Заказы' },
  { path: '/admin', icon: 'admin', label: 'Админ', adminOnly: true },
];

/**
 * Экраны со своей закреплённой кнопкой снизу — там навигация мешает.
 * Корзина в списке не случайно: рядом с её кнопкой «Оформить» таб-бар давал
 * двойной футер, который на iPhone упирался в полоску home indicator.
 */
const HIDDEN_ON = ['/product/', '/admin', '/checkout', '/order/', '/legal'];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartCount = useCartStore((s) => s.getItemCount());
  const isAdmin = useUserStore((s) => s.isAdmin);

  // Всплеск иконки привязан к смене адреса, а не к onClick: тогда он играет и при
  // программном переходе (кнопка «В каталог» из пустой корзины), и при системной
  // кнопке «назад». Счётчик, а не флаг, — чтобы повторное нажатие уже активной
  // вкладки тоже запускало анимацию: pathname при этом не меняется.
  const [burst, setBurst] = useState({ path: location.pathname, n: 0 });
  useEffect(() => {
    setBurst((prev) =>
      prev.path === location.pathname ? prev : { path: location.pathname, n: prev.n + 1 },
    );
  }, [location.pathname]);

  const tabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);

  if (HIDDEN_ON.some((prefix) => location.pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <motion.nav
      className="safe-bottom fixed bottom-0 left-0 right-0 z-nav"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
      aria-label="Основная навигация"
    >
      <div className="mx-auto max-w-lg">
        <div className="glass-nav mx-3 mb-3 flex items-center justify-around rounded-2xl border border-white/30 px-2 py-2 shadow-[0_-4px_30px_rgba(0,0,0,0.08)]">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => {
                  if (isActive) {
                    // Уже здесь: адрес не изменится, поэтому всплеск запускаем руками,
                    // и отклик мягче — это не переход, а просто «тык».
                    haptic.tap();
                    setBurst((prev) => ({ path: tab.path, n: prev.n + 1 }));
                    return;
                  }
                  haptic.press();
                  navigate(tab.path);
                }}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tab.label}
                className="relative flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-b from-primary/[0.14] to-primary/5 ring-1 ring-inset ring-primary/10"
                    transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
                  />
                )}

                {/* whileTap живёт здесь, а не на кнопке: масштабирование родителя
                    капсулы ломает layout-проекцию framer, и плашка при нажатии
                    дёргается на соседнюю вкладку. */}
                <motion.div
                  className={`relative z-10 transition-colors duration-300 ${
                    isActive ? 'text-primary' : 'text-text-sub'
                  }`}
                  whileTap={{ scale: 0.85 }}
                  transition={spring.snappy}
                >
                  <NavIcon
                    name={tab.icon}
                    active={isActive}
                    burstKey={burst.path === tab.path ? burst.n : 0}
                  />

                  {tab.path === '/cart' && cartCount > 0 && (
                    <AnimatePresence>
                      <motion.span
                        key={cartCount}
                        className="absolute -right-2.5 -top-1.5 z-20 flex min-w-[17px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[17px] text-white"
                        initial={{ scale: 0, rotate: -15 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                      >
                        {cartCount > 9 ? '9+' : cartCount}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </motion.div>

                <motion.span
                  className={`relative z-10 text-[10px] font-semibold transition-colors ${
                    isActive ? 'text-primary' : 'text-text-sub'
                  }`}
                  animate={{ opacity: isActive ? 1 : 0.8 }}
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
