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

// --- Order ---
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
}

export interface OrderResponse {
  id: number;
  totalPrice: number;
  discount: number;
  status: string;
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
}
