// Общие пресеты Framer Motion: анимации по всему приложению должны совпадать по
// характеру, а не подбираться заново в каждом файле — иначе одинаковые по смыслу
// переходы (карточка, модалка, шапка) начинают жить каждый своей жизнью.
import type { Variants, Transition } from 'framer-motion';

// Фирменная кривая замедления — по ней узнаётся весь интерфейс.
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const spring: Record<'soft' | 'snappy' | 'bouncy' | 'gentle', Transition> = {
  soft: { type: 'spring', stiffness: 220, damping: 26 },
  snappy: { type: 'spring', stiffness: 380, damping: 30 },
  bouncy: { type: 'spring', stiffness: 300, damping: 18 },
  gentle: { type: 'spring', stiffness: 160, damping: 20 },
};

/** Контейнер, проявляющий детей по очереди: список не «вспыхивает» целиком. */
export const staggerContainer = (stagger = 0.06, delayChildren = 0.05): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring.soft },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: spring.bouncy },
};

/** Проявление с размытием — только для крупных заголовков. */
export const blurUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE_OUT } },
};

// Упругая кривая с проскоком: конец жеста слегка перелетает цель и возвращается.
// Нужна там, где движение должно ощущаться пружинным, но с точным таймингом —
// кадровые «всплески» иконок таб-бара (components/NavIcon.tsx). Пружина Framer
// там не годится: у жеста 3–5 кадров с заданными долями времени, а спринг между
// кадрами растягивает их непредсказуемо, и «маятник» перестаёт быть маятником.
export const EASE_BOUNCE: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
