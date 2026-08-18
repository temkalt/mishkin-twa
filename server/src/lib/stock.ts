// Склад: резерв остатка при создании заказа и возврат при отмене.
//
// Правила, на которых держится вся логика:
//
//  1. `Product.stock === null` — учёт не ведётся, товар всегда доступен. Так
//     ведут себя все товары, созданные до появления склада: включать учёт
//     заказчик будет по одному, вписав число в админке.
//  2. Списание идёт в той же транзакции, что создание заказа. Условие
//     `stock >= qty` внутри UPDATE — сама Postgres не даст двум одновременным
//     заказам увести остаток в минус (пессимистичной блокировки не нужно).
//  3. Остаток резервируется в момент оформления, а не оплаты: иначе два
//     человека оплатят одну последнюю свечу. Возврат — при отмене заказа,
//     ровно один раз (защищает `Order.stockReturnedAt`).

import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/** Ниже этого остатка покупателю показываем «осталось N». */
export const LOW_STOCK_THRESHOLD = 5;

export interface StockError {
  productId: number;
  name: string;
  available: number;
}

/** Товар можно положить в корзину и оформить. */
export function isAvailable(product: { inStock: boolean; stock: number | null }): boolean {
  return product.inStock && (product.stock === null || product.stock > 0);
}

/**
 * Списывает остаток по позициям заказа. Вызывать только внутри транзакции,
 * вместе с созданием заказа.
 *
 * Возвращает `null`, если всё списалось, или описание первой позиции, которой
 * не хватило — в этот момент транзакцию нужно откатить (просто выбросив ошибку
 * или вернув управление наружу).
 */
export async function reserveStock(
  tx: Prisma.TransactionClient,
  items: Array<{ productId: number; name: string; qty: number; stock: number | null }>,
): Promise<StockError | null> {
  for (const item of items) {
    // Учёт по этому товару не ведётся — списывать нечего.
    if (item.stock === null) continue;

    const { count } = await tx.product.updateMany({
      where: { id: item.productId, stock: { gte: item.qty } },
      data: { stock: { decrement: item.qty } },
    });

    if (count === 0) {
      // Кто-то забрал остаток между чтением каталога и оформлением. Актуальное
      // количество читаем заново — покупателю важно знать, сколько осталось.
      const actual = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stock: true },
      });
      return { productId: item.productId, name: item.name, available: actual?.stock ?? 0 };
    }
  }

  return null;
}

/**
 * Возвращает остаток по отменённому заказу. Идемпотентно: первым делом
 * «занимает» право на возврат через условный UPDATE по `stockReturnedAt`,
 * поэтому повторная отмена (или гонка двух администраторов) остаток не задвоит.
 *
 * Возвращает true, если возврат выполнен именно этим вызовом.
 */
export async function releaseStockForOrder(orderId: number): Promise<boolean> {
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, stockReturnedAt: null },
    data: { stockReturnedAt: new Date() },
  });
  if (claimed.count === 0) return false;

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { items: true } });
  if (!order) return false;

  let items: Array<{ productId?: number; qty?: number }>;
  try {
    items = JSON.parse(order.items) as Array<{ productId?: number; qty?: number }>;
  } catch {
    console.error(`[stock] заказ #${orderId}: не удалось разобрать состав, остаток не возвращён`);
    return false;
  }

  // Суммируем по товару: одна и та же позиция может встретиться дважды.
  const byProduct = new Map<number, number>();
  for (const item of items) {
    if (!item?.productId || !item.qty) continue;
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.qty);
  }

  for (const [productId, qty] of byProduct) {
    // Только товарам с включённым учётом: `stock: { not: null }` не даёт
    // случайно «включить» склад тем, у кого его нет.
    await prisma.product.updateMany({
      where: { id: productId, stock: { not: null } },
      data: { stock: { increment: qty } },
    });
  }

  return true;
}
