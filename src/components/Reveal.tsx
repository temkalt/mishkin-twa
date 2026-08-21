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
 * Проявление при прокрутке. Обёртка над общим вариантом fadeUp — так тайминги
 * совпадают с остальным приложением, а не подбираются в каждом разделе заново.
 * once по умолчанию true: повторная анимация при скролле вверх-вниз раздражает.
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
