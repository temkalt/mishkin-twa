-- Синхронизация схемы: поля заказа, блок оплаты, журнал уведомлений и индексы.
--
-- Сгенерировано `prisma migrate diff` от состояния 20260804030602_init_pg,
-- после чего добавлены IF NOT EXISTS. Причина: базы, которые раньше
-- обновлялись через `prisma db push`, уже содержат часть колонок (userAddress,
-- userPostal, deliveryMethod, comment, tgUsername). Без IF NOT EXISTS
-- `migrate deploy` на такой базе падает на первой же существующей колонке,
-- а результат применения одинаков для чистой и для «подпушенной» базы.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "comment" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deliveryMethod" TEXT NOT NULL DEFAULT 'CDEK',
ADD COLUMN IF NOT EXISTS "deliveryPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "itemsTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentId" TEXT,
ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
ADD COLUMN IF NOT EXISTS "paymentType" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS "tgUsername" TEXT,
ADD COLUMN IF NOT EXISTS "trackNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "userAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "userPostal" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
    "id" SERIAL NOT NULL,
    "eventKey" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentEvent_eventKey_key" ON "PaymentEvent"("eventKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_telegramId_idx" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_isFeatured_idx" ON "Product"("isFeatured");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromoCode_isActive_idx" ON "PromoCode"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Order_paymentId_key" ON "Order"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_telegramUserId_idx" ON "Order"("telegramUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx" ON "Order"("paymentStatus");
