import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { fadeUp } from '../utils/motion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
}

/**
 * Scroll-triggered reveal. Fades + lifts its children into view the first time
 * they enter the viewport. Wraps the shared `fadeUp` variant so timing stays
 * consistent with the rest of the app.
 */
export function Reveal({ children, className, delay = 0, once = true }: RevealProps) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-40px 0px -40px 0px' }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
