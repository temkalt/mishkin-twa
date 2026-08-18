// Проверка миграций без риска для данных: всё выполняется во временной схеме
// `_mishkin_verify`, которая создаётся и удаляется этим же скриптом. Схема
// `public` не затрагивается.
//
// Проверяем два сценария:
//   A. чистая база: init_pg → sync_orders_payments → product_stock
//   B. база после `db push`: init_pg + 5 колонок вручную → те же миграции
// Оба должны дать одинаковую структуру и не упасть.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const SCHEMA = '_mishkin_verify';
const MIGRATIONS = [
  'prisma/migrations/20260804030602_init_pg/migration.sql',
  'prisma/migrations/20260817234247_sync_orders_payments/migration.sql',
  'prisma/migrations/20260818021500_product_stock/migration.sql',
];
const [INIT, ...REST] = MIGRATIONS;

const DRIFT = [
  `ALTER TABLE "Order" ADD COLUMN "userAddress" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "Order" ADD COLUMN "userPostal" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "Order" ADD COLUMN "deliveryMethod" TEXT NOT NULL DEFAULT 'CDEK'`,
  `ALTER TABLE "Order" ADD COLUMN "comment" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "Order" ADD COLUMN "tgUsername" TEXT`,
];

const EXPECTED_ORDER_COLUMNS = [
  'id', 'telegramUserId', 'userName', 'userPhone', 'userCity', 'userAddress', 'userPostal',
  'deliveryMethod', 'deliveryPrice', 'trackNumber', 'comment', 'tgUsername', 'items',
  'itemsTotal', 'totalPrice', 'promoCode', 'discount', 'status', 'stockReturnedAt', 'paymentType',
  'paymentStatus', 'paymentId', 'paymentMethod', 'paidAt', 'consentAt', 'createdAt', 'updatedAt',
];

/** Колонки, без которых не работает склад. */
const EXPECTED_PRODUCT_COLUMNS = ['stock'];

/** Разбить файл миграции на отдельные операторы: Prisma не принимает несколько в одном запросе. */
function statements(file) {
  return readFileSync(file, 'utf8')
    .split(/;\s*\r?\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/;\s*$/, ''));
}

const prisma = new PrismaClient();

async function scenario(name, extra) {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET search_path TO "${SCHEMA}"`);

    for (const sql of statements(INIT)) await tx.$executeRawUnsafe(sql);
    for (const sql of extra) await tx.$executeRawUnsafe(sql);
    for (const file of REST) {
      for (const sql of statements(file)) await tx.$executeRawUnsafe(sql);
    }

    const columns = await tx.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = '${SCHEMA}' AND table_name = 'Order'`,
    );
    const productColumns = await tx.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = '${SCHEMA}' AND table_name = 'Product'`,
    );
    const tables = await tx.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${SCHEMA}'`,
    );
    const indexes = await tx.$queryRawUnsafe(
      `SELECT indexname FROM pg_indexes WHERE schemaname = '${SCHEMA}'`,
    );
    return {
      columns: columns.map((c) => c.column_name),
      productColumns: productColumns.map((c) => c.column_name),
      tables: tables.map((t) => t.table_name).sort(),
      indexes: indexes.map((i) => i.indexname).sort(),
    };
  });

  const missing = EXPECTED_ORDER_COLUMNS.filter((c) => !result.columns.includes(c));
  const extraCols = result.columns.filter((c) => !EXPECTED_ORDER_COLUMNS.includes(c));
  const missingProduct = EXPECTED_PRODUCT_COLUMNS.filter((c) => !result.productColumns.includes(c));

  console.log(`\n[${name}]`);
  console.log('  таблицы:', result.tables.join(', '));
  console.log('  колонок в Order:', result.columns.length, missing.length ? `НЕ ХВАТАЕТ: ${missing}` : '— все на месте');
  if (extraCols.length) console.log('  лишние колонки:', extraCols.join(', '));
  console.log('  склад в Product:', missingProduct.length ? `НЕ ХВАТАЕТ: ${missingProduct}` : 'stock на месте');
  console.log('  индексов:', result.indexes.length);
  return { ok: missing.length === 0 && extraCols.length === 0 && missingProduct.length === 0, ...result };
}

try {
  const a = await scenario('A: чистая база', []);
  const b = await scenario('B: база после db push', DRIFT);

  const same =
    JSON.stringify([a.tables, a.indexes, [...a.columns].sort(), [...a.productColumns].sort()]) ===
    JSON.stringify([b.tables, b.indexes, [...b.columns].sort(), [...b.productColumns].sort()]);

  console.log('\nитог:', a.ok && b.ok && same ? 'ОК — оба сценария дают одинаковую корректную структуру' : 'ПРОБЛЕМА');
} catch (error) {
  console.log('\nОШИБКА:', error?.message?.split('\n').slice(0, 4).join(' | '));
  process.exitCode = 1;
} finally {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {});
  await prisma.$disconnect();
}
