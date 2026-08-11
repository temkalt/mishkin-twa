// Shared Framer Motion presets so every surface animates with one voice.
// Import these instead of redefining springs/variants per file.
import type { Variants, Transition } from 'framer-motion';

// Signature easing — the "expensive" decelerate curve used across the app.
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const spring: Record<'soft' | 'snappy' | 'bouncy' | 'gentle', Transition> = {
  soft: { type: 'spring', stiffness: 220, damping: 26 },
  snappy: { type: 'spring', stiffness: 380, damping: 30 },
  bouncy: { type: 'spring', stiffness: 300, damping: 18 },
  gentle: { type: 'spring', stiffness: 160, damping: 20 },
};

/** Container that reveals its children one after another. */
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

/** Blur-in reveal for hero/title text. */
export const blurUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE_OUT } },
};
