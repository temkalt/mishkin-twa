import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { EASE_OUT } from '../utils/motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  /** Подставляется после числа — например, ' ₽'. */
  suffix?: string;
  duration?: number;
}

/**
 * Перематывает число от прежнего значения к новому. Нужно в корзине: сумма там
 * меняется от каждого шага счётчика, и мгновенная подмена цифр читается как
 * подёргивание, а не как пересчёт.
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
