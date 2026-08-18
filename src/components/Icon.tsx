// Единая точка для иконок.
//
// Раньше иконки тянулись шрифтом Material Symbols с Google Fonts. В
// Telegram-webview это давало заметный «прыжок» (пока шрифт не загрузился,
// вместо иконок видны слова вроде "shopping_bag"), плюс лишняя внешняя
// зависимость — критично для российских сетей и для CSP.
//
// Здесь иконки — inline SVG из lucide-react: ноль сетевых запросов, единая
// толщина линии, tree-shaking по именам. Ключи словаря совпадают с прежними
// именами Material Symbols, чтобы разметка читалась так же, как раньше.

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowLeft,
  BellRing,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Flame,
  Gem,
  House,
  Info,
  LayoutGrid,
  Leaf,
  LoaderCircle,
  MapPin,
  Megaphone,
  MessageCircle,
  Minus,
  Package,
  PackageCheck,
  Palette,
  Pencil,
  Percent,
  Phone,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  SearchX,
  Send,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Truck,
  User,
  Users,
  Wallet,
  Wind,
  X,
} from 'lucide-react';

const ICONS = {
  activity: Activity,
  add: Plus,
  admin: ShieldCheck,
  alert: CircleAlert,
  arrow_back: ArrowLeft,
  cancel: CircleX,
  card: CreditCard,
  chart: ChartColumn,
  chat: MessageCircle,
  check: Check,
  check_circle: CircleCheck,
  chevron_down: ChevronDown,
  chevron_right: ChevronRight,
  clock: Clock,
  close: X,
  copy: Copy,
  delete: Trash2,
  diamond: Gem,
  edit: Pencil,
  external: ExternalLink,
  flame: Flame,
  group: Users,
  grid: LayoutGrid,
  home: House,
  info: Info,
  leaf: Leaf,
  location: MapPin,
  megaphone: Megaphone,
  notifications: BellRing,
  package: Package,
  package_done: PackageCheck,
  palette: Palette,
  percent: Percent,
  person: User,
  phone: Phone,
  receipt: Receipt,
  receipt_long: ReceiptText,
  remove: Minus,
  search: Search,
  search_off: SearchX,
  send: Send,
  shipping: Truck,
  shopping_bag: ShoppingBag,
  smartphone: Smartphone,
  spinner: LoaderCircle,
  sparkles: Sparkles,
  star: Star,
  trending_up: TrendingUp,
  wallet: Wallet,
  wind: Wind,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  /** Размер в пикселях. По умолчанию 20 — как большинство иконок в интерфейсе. */
  size?: number;
  className?: string;
  /** Тонкая линия для крупных декоративных иконок, жирная — для мелких. */
  strokeWidth?: number;
  /** Залить контур: используется для активной вкладки в навигации. */
  filled?: boolean;
  'aria-hidden'?: boolean;
}

export function Icon({ name, size = 20, className, strokeWidth, filled, ...rest }: IconProps) {
  const Component = ICONS[name];
  // Мелкие иконки читаются хуже — им нужна чуть более плотная линия.
  const stroke = strokeWidth ?? (size <= 16 ? 2.1 : size >= 32 ? 1.5 : 1.85);

  return (
    <Component
      size={size}
      strokeWidth={stroke}
      className={className}
      {...(filled ? { fill: 'currentColor', fillOpacity: 0.16 } : {})}
      aria-hidden={rest['aria-hidden'] ?? true}
    />
  );
}
