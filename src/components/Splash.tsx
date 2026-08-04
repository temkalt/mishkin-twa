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
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        // We trigger onComplete slightly before the exit animation fully finishes if we want,
        // but here we just wait for the component to unmount from the parent.
      }}
    >
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 100, 
          damping: 20,
          duration: 0.8
        }}
        onAnimationComplete={() => {
          // Stay on screen for 1 second, then trigger completion
          setTimeout(onComplete, 1200);
        }}
      >
        <h1 className="font-bahnschrift text-4xl font-bold tracking-[0.2em] text-primary uppercase">
          Mishkin
        </h1>
        <motion.div 
          className="h-[1px] bg-primary"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
        />
        <motion.span 
          className="text-[10px] tracking-widest text-text-sub uppercase font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          Slow Living Art
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
