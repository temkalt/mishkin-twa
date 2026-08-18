// --- Product ---
export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number; // в рублях (уже конвертировано на сервере)
  category: string;
  topNote: string;
  heartNote: string;
  baseNote: string;
  images: string[];
  inStock: boolean;
  /** Остаток в штуках. `null` — учёт не ведётся, товар всегда доступен. */
  stock: number | null;
  isFeatured: boolean;
}

// --- Cart ---
export interface CartItem {
  productId: number;
  name: string;
  price: number;
  qty: number;
  image: string;
}

// --- Доставка ---
export interface DeliveryOption {
  id: string;
  label: string;
  price: number; // в рублях
  requiresAddress: boolean;
  hint: string;
}

export interface DeliveryConfig {
  freeFrom: number; // в рублях, 0 — порога нет
  options: DeliveryOption[];
}

// --- Order ---
export type PaymentType = 'ONLINE' | 'MANUAL';
export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'CANCELED' | 'REFUNDED';
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'SHIPPED' | 'DONE' | 'CANCELLED';

export interface OrderCreatePayload {
  items: Array<{ productId: number; qty: number }>;
  userName: string;
  userPhone: string;
  userCity: string;
  userAddress: string;
  userPostal: string;
  deliveryMethod: string;
  comment: string;
  promoCode?: string;
  paymentType: PaymentType;
  consent: true;
}

export interface OrderResponse {
  id: number;
  itemsTotal: number;
  deliveryPrice: number;
  totalPrice: number;
  discount: number;
  status: OrderStatus;
  paymentType: PaymentType;
  paymentStatus: PaymentStatus;
}

export interface OrderItem {
  productId: number;
  name: string;
  price: number; // в копейках — как сохранено в заказе
  qty: number;
  image?: string;
}

export interface Order {
  id: number;
  itemsTotal: number;
  deliveryPrice: number;
  totalPrice: number;
  discount: number;
  status: OrderStatus;
  paymentType: PaymentType;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paidAt: string | null;
  trackNumber: string;
  createdAt: string;
  items: OrderItem[];
  userName?: string;
  userPhone?: string;
  userCity?: string;
  userAddress?: string;
  userPostal?: string;
  deliveryMethod?: string;
  comment?: string;
  tgUsername?: string | null;
}

// --- Оплата ---
export interface PaymentConfig {
  online: boolean;
  /** true — работает встроенный эмулятор, реальных списаний нет. */
  mock: boolean;
  /** true — тестовый контур (эмулятор или тестовый магазин ЮKassa). */
  test: boolean;
  provider: string;
}

export interface PaymentStartResponse {
  paymentId: string;
  confirmationUrl: string;
  status: PaymentStatus;
  mock: boolean;
  test: boolean;
  amount: number;
}

export interface PaymentStatusResponse {
  orderId: number;
  status: OrderStatus;
  paymentType: PaymentType;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paidAt: string | null;
  totalPrice: number;
  itemsCount: number;
}

// --- Promo ---
export interface PromoValidateResponse {
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
}

// --- User ---
export interface UserAuth {
  id: number;
  telegramId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  isAdmin: boolean;
  guest: boolean;
}
