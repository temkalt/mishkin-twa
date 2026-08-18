// Способы доставки и их стоимость. Единый источник истины: фронт получает
// этот список через API, поэтому цифры в корзине и в заказе не разъезжаются.

export interface DeliveryOption {
  /** Код, который уходит в заказ. */
  id: string;
  label: string;
  /** Стоимость в копейках. */
  price: number;
  /** Нужен ли адрес и индекс. Для самовывоза — нет. */
  requiresAddress: boolean;
  hint: string;
}

/** Бесплатная доставка от этой суммы (в копейках). 0 — выключить. */
export const FREE_DELIVERY_FROM = 500000; // 5 000 ₽

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'CDEK',
    label: 'СДЭК',
    price: 35000,
    requiresAddress: true,
    hint: 'до пункта выдачи, 2–5 дней',
  },
  {
    id: 'POST',
    label: 'Почта России',
    price: 30000,
    requiresAddress: true,
    hint: 'по всей России, 5–14 дней',
  },
  {
    id: 'BOXBERRY',
    label: 'Boxberry',
    price: 30000,
    requiresAddress: true,
    hint: 'до пункта выдачи, 3–7 дней',
  },
  {
    id: 'PICKUP',
    label: 'Самовывоз',
    price: 0,
    requiresAddress: false,
    hint: 'Москва, согласуем время в переписке',
  },
];

export function findDeliveryOption(id: string): DeliveryOption | undefined {
  // Принимаем и старые русские названия из ранних заказов.
  const legacy: Record<string, string> = {
    'СДЭК': 'CDEK',
    'Почта России': 'POST',
    Boxberry: 'BOXBERRY',
    Самовывоз: 'PICKUP',
  };
  const code = legacy[id] || id;
  return DELIVERY_OPTIONS.find((option) => option.id === code);
}

/** Стоимость доставки с учётом порога бесплатной. */
export function deliveryPriceFor(optionId: string, goodsTotal: number): number {
  const option = findDeliveryOption(optionId);
  if (!option) return 0;
  if (FREE_DELIVERY_FROM > 0 && goodsTotal >= FREE_DELIVERY_FROM) return 0;
  return option.price;
}
