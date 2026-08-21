// Иконки нижней навигации с собственной микроанимацией на переключение.
//
// Почему не общий Icon.tsx: у lucide каждая иконка — цельный контур. Крыша домика
// нарисована тем же path, что и стены, зубчатый край чека — тем же, что бумага.
// Поднять крышу или пустить волну по зубцам на такой геометрии нельзя, поэтому
// здесь она разобрана на детали и у каждой свой вариант движения. Пропорции,
// толщина линии и скругления взяты у lucide один в один, чтобы таб-бар не
// выбивался из остальных иконок приложения.
//
// Каждый вариант `play` — массив кадров, который начинается и заканчивается в
// состоянии покоя. Поэтому всплеск можно запускать повторно (controls.start)
// без возврата в rest и без перемонтирования SVG: повторное нажатие уже
// активной вкладки тоже отзывается движением.
//
// Точка опоры: framer-motion выставляет анимируемым SVG-деталям
// transform-box: fill-box, то есть transform-origin считается от габаритов самой
// детали (motion-dom/render/svg/utils/build-attrs). Все нужные опоры совпали с её
// краями, поэтому origin задаётся процентами: '50% 100%' — «от земли»,
// '50% 0%' — «от крепления». Пиксельные значения тут молча уехали бы, потому что
// считались бы не от viewBox.

import { useEffect, type ReactElement } from 'react';
import { motion, useAnimationControls, useReducedMotion, type Transition } from 'framer-motion';
import { EASE_BOUNCE, EASE_OUT } from '../utils/motion';

export type NavIconName = 'home' | 'grid' | 'shopping_bag' | 'receipt_long' | 'admin';

/** Кадровый всплеск: duration — на весь жест, times — доли, в которых стоят кадры. */
const burst = (duration: number, times: number[], delay = 0): Transition => ({
  duration,
  times,
  ease: EASE_BOUNCE,
  delay,
});

// Заливка активной иконки ставится атрибутом fill-opacity, а не через framer:
// вариантами её трогать нельзя — вкладка гаснет без всплеска (при уходе на другую
// вкладку анимация не проигрывается), и последний кадр остался бы залитым.
// Презентационный атрибут участвует в каскаде как обычное свойство, поэтому
// плавность даёт CSS-переход.
const INK = 'transition-[fill-opacity] duration-300';
const FROM_GROUND = { transformOrigin: '50% 100%' };
const FROM_MOUNT = { transformOrigin: '50% 0%' };

type PartProps = { active: boolean };

// ─────────────────────────────────────────────────────────────────────────────
// 🏠 Elastic House Bounce — крыша подпрыгивает, стены пружинят, дверь «пыхает».
// ─────────────────────────────────────────────────────────────────────────────
const ROOF = 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10';
const WALLS = 'M4.6 9.1V19a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2V9.1';
const DOOR = 'M15 21v-7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v7';

function HomeParts({ active }: PartProps) {
  return (
    <>
      <motion.path
        d={WALLS}
        className={INK}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.16 : 0}
        style={FROM_GROUND}
        variants={{
          rest: { scaleY: 1, scaleX: 1 },
          // Сжатие с отдачей: стены проседают под ударом крыши и перепрыгивают обратно.
          play: {
            scaleY: [1, 0.88, 1.05, 1],
            scaleX: [1, 1.07, 0.98, 1],
            transition: burst(0.62, [0, 0.34, 0.64, 1]),
          },
        }}
      />
      <motion.path
        d={ROOF}
        variants={{
          rest: { y: 0, scaleX: 1 },
          play: {
            y: [0, -2.7, 0.5, 0],
            scaleX: [1, 1.06, 0.99, 1],
            transition: burst(0.66, [0, 0.3, 0.62, 1]),
          },
        }}
      />
      <motion.path
        d={DOOR}
        style={FROM_GROUND}
        variants={{
          rest: { scaleY: 1, opacity: 1 },
          // Дверь распахивается вверх на полкадра позже крыши — «отклик» внутри дома.
          play: {
            scaleY: [1, 0.55, 1.12, 1],
            opacity: [1, 0.55, 1, 1],
            transition: burst(0.58, [0, 0.28, 0.6, 1], 0.08),
          },
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔲 Staggered Grid Twist & Pop — четыре плитки складываются по очереди.
// ─────────────────────────────────────────────────────────────────────────────
// Порядок обхода — по часовой от левого верхнего: волна читается как сборка
// пазла, а не как случайное мерцание.
const CELLS: Array<[number, number]> = [
  [3, 3],
  [14, 3],
  [14, 14],
  [3, 14],
];

function GridParts({ active }: PartProps) {
  return (
    <>
      {CELLS.map(([x, y], i) => (
        <motion.rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="7"
          height="7"
          rx="1"
          className={INK}
          fill={active ? 'currentColor' : 'none'}
          fillOpacity={active ? 0.16 : 0}
          variants={{
            rest: { rotate: 0, scale: 1 },
            // 92° вместо 90°: плитка чуть перелетает и щёлкает на место.
            // Задержка по 40 мс на плитку — каскад читается как сборка пазла.
            // Задаём её явно, а не staggerChildren: у обёртки-группы всё равно
            // нет своего движения, а порядок кадров тут важнее лишнего узла.
            play: {
              rotate: [0, 92, 0],
              scale: [1, 0.76, 1],
              transition: burst(0.56, [0, 0.46, 1], i * 0.04),
            },
          }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛍️ Shopping Bag Swing & Drop — ручка подскакивает, сумка качается на ней.
// ─────────────────────────────────────────────────────────────────────────────
const BAG_BODY =
  'M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z';
const BAG_SEAM = 'M3.103 6.034h17.794';
const BAG_HANDLE = 'M16 10a4 4 0 0 1-8 0';

function BagParts({ active }: PartProps) {
  return (
    // Маятник качает всю сумку целиком, поэтому вращение живёт на группе, а не на
    // отдельных путях: иначе шов и ручка отстают от корпуса.
    <motion.g
      style={FROM_MOUNT}
      variants={{
        rest: { rotate: 0 },
        // Затухающий маятник: −12° → +8° → −3° → 0°, как будто в сумку только что
        // опустили покупку.
        play: {
          rotate: [0, -12, 8, -3, 0],
          transition: burst(0.72, [0, 0.2, 0.48, 0.74, 1]),
        },
      }}
    >
      <motion.path
        d={BAG_BODY}
        className={INK}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.16 : 0}
        style={FROM_GROUND}
        variants={{
          rest: { scaleY: 1 },
          // Вес падающей покупки: дно проседает на кадр и выравнивается.
          play: { scaleY: [1, 1, 1.06, 0.99, 1], transition: burst(0.72, [0, 0.4, 0.6, 0.8, 1]) },
        }}
      />
      <path d={BAG_SEAM} />
      <motion.path
        d={BAG_HANDLE}
        style={FROM_MOUNT}
        variants={{
          rest: { y: 0, scaleY: 1 },
          play: {
            y: [0, -2, 0.5, 0],
            scaleY: [1, 1.22, 0.94, 1],
            transition: burst(0.6, [0, 0.28, 0.62, 1]),
          },
        }}
      />
    </motion.g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧾 Receipt Unfurl & Wave — чек выезжает из кассы, по зубцам идёт волна.
// ─────────────────────────────────────────────────────────────────────────────
// Бумага без зубчатого края: край вынесен отдельными деталями, чтобы по нему
// прошла волна. Тянется вниз от верхней кромки.
const PAPER =
  'M4 2.3v17.4a1 1 0 0 0 1.5.87l1.5-.87 1.5.87a1 1 0 0 0 1 0l1.5-.87 1.5.87a1 1 0 0 0 1 0l1.5-.87 1.5.87a1 1 0 0 0 1.5-.87V2.3a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1z';
const ROWS = ['M14 8H8', 'M16 12H8', 'M13 16H8'];

function ReceiptParts({ active }: PartProps) {
  return (
    <>
      <motion.path
        d={PAPER}
        className={INK}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.16 : 0}
        style={FROM_MOUNT}
        variants={{
          rest: { scaleY: 1 },
          // Лента вытягивается на 10% и подбирается назад с мягким торможением.
          play: { scaleY: [1, 1.1, 0.99, 1], transition: burst(0.68, [0, 0.42, 0.72, 1]) },
        }}
      />
      {ROWS.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          variants={{
            rest: { y: 0, opacity: 1 },
            // Строки едут вместе с бумагой, но с задержкой по одной — это и есть
            // волна. 1.55 = ход нижней кромки при scaleY 1.1 на высоте 15.5.
            play: {
              y: [0, 1.55, 1.05, 0],
              opacity: [1, 0.65, 1, 1],
              transition: burst(0.68, [0, 0.42, 0.72, 1], 0.05 + i * 0.055),
            },
          }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️ Shield Pulse & Checkmark Snap — щит пульсирует, галочка прочерчивается.
// ─────────────────────────────────────────────────────────────────────────────
const SHIELD =
  'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';
const CHECK = 'm9 12 2 2 4-4';

function ShieldParts({ active }: PartProps) {
  return (
    <>
      {/* Кольцо-отголосок: расходится за щитом и гаснет — «объём» импульса. */}
      <motion.circle
        cx="12"
        cy="12"
        r="9"
        strokeWidth="1.4"
        variants={{
          rest: { opacity: 0, scale: 0.8 },
          play: {
            opacity: [0, 0.45, 0],
            scale: [0.8, 1.25, 1.35],
            transition: { duration: 0.6, times: [0, 0.35, 1], ease: EASE_OUT },
          },
        }}
      />
      <motion.path
        d={SHIELD}
        className={INK}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.16 : 0}
        variants={{
          rest: { scale: 1 },
          play: { scale: [1, 1.16, 0.95, 1], transition: burst(0.64, [0, 0.3, 0.62, 1]) },
        }}
      />
      <motion.path
        d={CHECK}
        variants={{
          rest: { pathLength: 1, rotate: 0, scale: 1, opacity: 1 },
          // Галочка прочерчивается и защёлкивается: доворот из −34° с проскоком.
          play: {
            pathLength: [0.05, 1, 1],
            rotate: [-34, 8, 0],
            scale: [0.7, 1.14, 1],
            opacity: [0.4, 1, 1],
            transition: burst(0.58, [0, 0.62, 1], 0.12),
          },
        }}
      />
    </>
  );
}

const PARTS: Record<NavIconName, (props: PartProps) => ReactElement> = {
  home: HomeParts,
  grid: GridParts,
  shopping_bag: BagParts,
  receipt_long: ReceiptParts,
  admin: ShieldParts,
};

type NavIconProps = {
  name: NavIconName;
  /** Вкладка выбрана: иконка подкрашивается изнутри. */
  active: boolean;
  /** Счётчик нажатий: любое изменение (кроме 0) запускает всплеск заново. */
  burstKey: number;
  size?: number;
};

export function NavIcon({ name, active, burstKey, size = 22 }: NavIconProps) {
  const controls = useAnimationControls();
  // Глобальный @media (prefers-reduced-motion) в index.css гасит только CSS-анимации,
  // до JS-анимации framer он не достаёт — проверяем сами.
  const calm = useReducedMotion();
  const Parts = PARTS[name];

  useEffect(() => {
    if (!burstKey || calm) return;
    void controls.start('play');
  }, [burstKey, calm, controls]);

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Крыша и ручка выходят за viewBox на пике — без этого их срезает.
      overflow="visible"
      aria-hidden="true"
      initial="rest"
      animate={controls}
    >
      <Parts active={active} />
    </motion.svg>
  );
}
