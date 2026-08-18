// Временная диагностика: доступна ли база и применены ли миграции.
// Только чтение. Строки подключения не печатаем.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL || '';
if (!url) {
  console.log('DATABASE_URL: не задан');
  process.exit(0);
}
console.log('DATABASE_URL: задан, провайдер =', url.split(':')[0]);

const prisma = new PrismaClient();

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log('подключение: ок');

  const migrations = await prisma.$queryRawUnsafe(
    `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at`,
  ).catch(() => null);

  if (!migrations) {
    console.log('_prisma_migrations: таблицы нет (база создавалась через db push) → нужен baseline');
  } else {
    console.log('применённые миграции:');
    for (const m of migrations) console.log('  -', m.migration_name, m.finished_at ? 'ok' : 'НЕ ЗАВЕРШЕНА');
  }

  const columns = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Order' ORDER BY column_name`,
  ).catch(() => []);
  const names = columns.map((c) => c.column_name);
  const required = ['paymentStatus', 'paymentId', 'deliveryPrice', 'trackNumber', 'itemsTotal', 'consentAt', 'stockReturnedAt'];
  const missing = required.filter((c) => !names.includes(c));
  console.log('колонок в Order:', names.length, missing.length ? `НЕ ХВАТАЕТ: ${missing.join(', ')}` : '— все нужные на месте');

  const productColumns = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Product'`,
  ).catch(() => []);
  console.log('склад (Product.stock):', productColumns.some((c) => c.column_name === 'stock') ? 'есть' : 'НЕТ');

  const paymentEvent = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('"PaymentEvent"') IS NOT NULL AS present`,
  ).catch(() => [{ present: false }]);
  console.log('таблица PaymentEvent:', paymentEvent[0]?.present ? 'есть' : 'нет');

  const [products, orders] = await Promise.all([
    prisma.product.count().catch(() => 'ошибка'),
    prisma.order.count().catch(() => 'ошибка'),
  ]);
  console.log('товаров:', products, '| заказов:', orders);
} catch (error) {
  console.log('подключение: НЕ УДАЛОСЬ —', error?.message?.split('\n')[0]);
} finally {
  await prisma.$disconnect();
}
