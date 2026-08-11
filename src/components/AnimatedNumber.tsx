import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { EASE_OUT } from '../utils/motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  /** Appended after the formatted number, e.g. ' ₽'. */
  suffix?: string;
  duration?: number;
}

/**
 * Smoothly counts from its previous value to the new one whenever `value`
 * changes — used for cart totals so price updates feel alive, not instant.
 */
export function AnimatedNumber({ value, className, suffix = '', duration = 0.5 }: AnimatedNumberProps) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString('ru-RU') + suffix);

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: EASE_OUT });
    return controls.stop;
  }, [value, mv, duration]);

  return <motion.span className={className}>{text}</motion.span>;
}
