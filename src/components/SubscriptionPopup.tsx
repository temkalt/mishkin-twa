import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './Icon';

const STORAGE_KEY = 'mishkin_subscribed';
/** Когда истекает «возможно, позже». Без этого попап всплывал при каждом входе. */
const SNOOZE_KEY = 'mishkin_subscribe_snoozed_until';
const SNOOZE_DAYS = 7;
/** Адрес канала переопределяется сборкой — в коде он был захардкожен в двух местах. */
const CHANNEL_URL = import.meta.env.VITE_CHANNEL_URL || 'https://t.me/mishkin_candles';

export function SubscriptionPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (snoozedUntil > Date.now()) return;

    // Шесть секунд — попап всплывает поверх ещё не осмотренного каталога, поэтому
    // сначала даём человеку осмотреться и только потом просим подписку.
    const timer = setTimeout(() => setIsOpen(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
    setIsOpen(false);
  };

  const handleSubscribe = () => {
    // Факт подписки не проверить: Telegram не сообщает Mini App, вступил ли человек
    // в канал. Поэтому считаем нажатие согласием и больше не спрашиваем — повторный
    // попап у подписчика раздражает сильнее, чем упущенная подписка.
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);

    // Внутри Telegram канал открываем через openTelegramLink: window.open там
    // выкидывает пользователя во внешний браузер и приложение теряет контекст.
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(CHANNEL_URL);
    } else {
      window.open(CHANNEL_URL, '_blank');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 px-4 pb-[calc(1rem+var(--safe-bottom))] pt-[calc(1rem+var(--app-top))] backdrop-blur-sm"
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
              onClick={handleDismiss}
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-pastel-sand/50 text-text-main transition-colors hover:bg-pastel-sand"
              aria-label="Закрыть"
            >
              <Icon name="close" size={18} />
            </button>

            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name="notifications" size={24} />
            </div>
            
            <h3 className="mb-2 font-display text-xl font-bold text-text-main">
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
                onClick={handleDismiss}
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
