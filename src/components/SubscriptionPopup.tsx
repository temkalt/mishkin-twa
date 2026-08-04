import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function SubscriptionPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if we already showed it
    const hasSeenPopup = localStorage.getItem('mishkin_has_seen_sub_popup');
    
    if (!hasSeenPopup) {
      // Delay showing the popup a bit after entering the app
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('mishkin_has_seen_sub_popup', 'true');
  };

  const handleSubscribe = () => {
    // Use Telegram Web App API to open link if available
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink('https://t.me/mishkin_candles');
    } else {
      window.open('https://t.me/mishkin_candles', '_blank');
    }
    handleClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-background-light p-6 shadow-2xl"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <button 
              onClick={handleClose}
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-pastel-sand/50 text-text-main transition-colors hover:bg-pastel-sand"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[24px]">notifications_active</span>
            </div>
            
            <h3 className="mb-2 font-bahnschrift text-xl font-bold text-text-main">
              Присоединяйтесь к клубу
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-text-sub">
              Подпишитесь на наш канал, там много интересного о свечах, процессов ручной работы и анонсы новых ароматов!
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleSubscribe}
                className="w-full rounded-xl bg-primary py-3.5 font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-[0.98] active:scale-95"
              >
                Подписаться
              </button>
              <button 
                onClick={handleClose}
                className="w-full py-2 text-sm font-medium text-text-sub hover:text-text-main"
              >
                Возможно, позже
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
