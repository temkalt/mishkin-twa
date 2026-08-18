// Склад на стороне клиента: одни и те же правила для каталога, карточки товара
// и корзины. Сервер — источник истины (он списывает остаток в транзакции), здесь
// только подсказки, чтобы человек не узнавал о нехватке на последнем шаге.

/** Ниже этого остатка показываем «осталось N» — то же число, что на сервере. */
export const LOW_STOCK_THRESHOLD = 5;

/** Максимум штук в одной позиции, если учёт склада не ведётся (лимит сервера). */
export const MAX_QTY = 99;

interface StockFields {
  inStock: boolean;
  /** `null` или `undefined` — учёт не ведётся. */
  stock?: number | null;
}

/** Товар можно добавить в корзину и оформить. */
export function isAvailable(product: StockFields): boolean {
  return product.inStock && (product.stock == null || product.stock > 0);
}

/** Сколько штук этой позиции можно заказать. */
export function maxQty(product: StockFields): number {
  return product.stock == null ? MAX_QTY : Math.min(MAX_QTY, product.stock);
}

/**
 * Подпись об остатке — только когда она что-то значит: «осталось 2 шт.»
 * подталкивает к покупке, «осталось 340 шт.» выглядит как складская выгрузка.
 */
export function stockHint(product: StockFields): string | null {
  if (!product.inStock) return null;
  if (product.stock == null) return null;
  if (product.stock <= 0) return 'Нет в наличии';
  if (product.stock <= LOW_STOCK_THRESHOLD) return `Осталось ${product.stock} шт.`;
  return null;
}
