import { motion } from 'framer-motion';

interface SplashProps {
  onComplete: () => void;
}

export function Splash({ onComplete }: SplashProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background-light"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="flex flex-col items-center gap-5"
        initial={{ scale: 0.85, opacity: 0, y: 25 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        onAnimationComplete={() => {
          setTimeout(onComplete, 1400);
        }}
      >
        <motion.img
          src="/images/logo123.png"
          alt="Mishkin"
          className="size-20 rounded-2xl object-cover shadow-lg"
          initial={{ rotate: -10, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        />
        <h1 className="font-display text-4xl font-bold tracking-[0.2em] text-primary uppercase">
          Mishkin
        </h1>
        <motion.div
          className="h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: '120px', opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
        />
        <motion.span
          className="text-[10px] tracking-[0.25em] text-text-sub uppercase font-medium"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          Ароматические свечи
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
