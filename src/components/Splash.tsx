import { motion } from 'framer-motion';
import { EASE_OUT } from '../utils/motion';

interface SplashProps {
  onComplete: () => void;
}

// A few ambient particles drifting upward like warm embers.
const EMBERS = [
  { x: '-42%', d: 0.0, s: 3, dur: 3.2 },
  { x: '-18%', d: 0.5, s: 2, dur: 3.8 },
  { x: '20%', d: 0.9, s: 4, dur: 3.0 },
  { x: '44%', d: 0.3, s: 2, dur: 4.1 },
  { x: '6%', d: 1.2, s: 3, dur: 3.5 },
];

export function Splash({ onComplete }: SplashProps) {
  return (
    <motion.div
      className="mesh-bg fixed inset-0 z-splash flex items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
    >
      {/* Soft warm aura */}
      <motion.div
        className="absolute size-72 rounded-full bg-gradient-to-tr from-accent/25 via-warm-accent/20 to-transparent blur-3xl pointer-events-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [0.8, 1.2, 1], opacity: [0, 0.8, 0.5] }}
        transition={{ duration: 1.6, ease: EASE_OUT }}
      />

      {/* Subtle warm rings */}
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-accent/20 pointer-events-none"
          style={{ width: 190 + i * 80, height: 190 + i * 80 }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: [0, 0.45, 0.18] }}
          transition={{ duration: 1.6, delay: i * 0.2, ease: EASE_OUT }}
        />
      ))}

      {/* Drifting warm embers */}
      {EMBERS.map((e, i) => (
        <motion.span
          key={i}
          className="absolute bottom-1/3 rounded-full bg-accent/70 pointer-events-none"
          style={{ width: e.s, height: e.s, left: `calc(50% + ${e.x})` }}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: -120, opacity: [0, 1, 0] }}
          transition={{ duration: e.dur, delay: 0.4 + e.d, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}

      <motion.div
        className="relative z-10 flex flex-col items-center gap-5"
        initial={{ scale: 0.88, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        onAnimationComplete={() => setTimeout(onComplete, 700)}
      >
        {/* Logo with 3D flip-in + sheen sweep */}
        <motion.div
          className="relative size-20 overflow-hidden rounded-2xl shadow-lift"
          initial={{ rotateY: -90, opacity: 0, scale: 0.8 }}
          animate={{ rotateY: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 16, delay: 0.08 }}
        >
          <img src="/images/logo123.png" alt="Mishkin" className="size-full object-cover" />
          <span className="sheen" />
        </motion.div>

        {/* Brand name — masked wipe reveal */}
        <div className="overflow-hidden">
          <motion.h1
            className="text-gradient font-display text-4xl font-bold uppercase tracking-[0.25em]"
            initial={{ y: '110%' }}
            animate={{ y: '0%' }}
            transition={{ delay: 0.28, duration: 0.6, ease: EASE_OUT }}
          >
            Mishkin
          </motion.h1>
        </div>

        {/* Animated underline */}
        <motion.div
          className="h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: '120px', opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.7, ease: EASE_OUT }}
        />

        <motion.p
          className="text-[10px] font-semibold uppercase tracking-[0.35em] text-text-sub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.72, duration: 0.5 }}
        >
          ручная работа
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
