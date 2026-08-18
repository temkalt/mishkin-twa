-- Учёт остатков: количество товара на складе и отметка возврата остатка при отмене заказа.
--
-- Обе колонки nullable и без DEFAULT. На существующих товарах "stock" = NULL, а
-- это в коде означает «учёт не ведётся» — магазин после миграции работает точно
-- так же, как до неё. Склад включается по одному товару: заказчик вписывает
-- число в админке.
--
-- IF NOT EXISTS — по той же причине, что в 20260817234247_sync_orders_payments:
-- миграция обязана применяться и на базу, которую раньше обновляли `db push`.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stock" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stockReturnedAt" TIMESTAMP(3);
