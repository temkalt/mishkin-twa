import { motion } from 'framer-motion';

interface SplashProps {
  onComplete: () => void;
}

export function Splash({ onComplete }: SplashProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background-light"
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.08,
        filter: 'blur(8px)',
      }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Ambient glow behind logo */}
      <motion.div
        className="absolute size-48 rounded-full bg-primary/10"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1.4, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{ filter: 'blur(40px)' }}
      />

      <motion.div
        className="relative flex flex-col items-center gap-5"
        initial={{ scale: 0.88, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        onAnimationComplete={() => {
          setTimeout(onComplete, 750);
        }}
      >
        {/* Logo with 3D flip-in */}
        <motion.img
          src="/images/logo123.png"
          alt="Mishkin"
          className="size-20 rounded-2xl object-cover shadow-xl shadow-primary/20"
          initial={{ rotateY: -90, opacity: 0, scale: 0.8 }}
          animate={{ rotateY: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 16, delay: 0.08 }}
        />

        {/* Brand name */}
        <motion.h1
          className="font-display text-4xl font-bold tracking-[0.25em] text-primary uppercase"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          Mishkin
        </motion.h1>

        {/* Animated line */}
        <motion.div
          className="h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: '110px', opacity: 1 }}
          transition={{ delay: 0.48, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Tagline */}
        <motion.p
          className="text-[10px] font-semibold uppercase tracking-[0.35em] text-text-sub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          ручная работа
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
