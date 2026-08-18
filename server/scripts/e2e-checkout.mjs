// Сквозная проверка потока покупки на реальном Express-приложении.
//
// Безопасность данных: работаем во временной схеме Postgres `_mishkin_e2e`,
// которая создаётся и удаляется здесь же. Схема `public` (товары и заказы
// заказчика) не затрагивается.
//
// Безопасность внешнего мира: BOT_TOKEN подменяется на заглушку, ADMIN_IDS
// очищается, оплата принудительно в режиме эмулятора — ни одного реального
// сообщения в Telegram и ни одного запроса в ЮKassa.
//
// Запуск: node scripts/e2e-checkout.mjs

import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const SCHEMA = '_mishkin_e2e';
const PORT = 3999;

const base = process.env.DATABASE_URL;
if (!base) {
  console.error('DATABASE_URL не задан — тест пропущен.');
  process.exit(1);
}

/** Тот же сервер, но отдельная схема. */
function withSchema(url) {
  const u = new URL(url);
  u.searchParams.set('schema', SCHEMA);
  return u.toString();
}

const testUrl = withSchema(base);
const testDirectUrl = process.env.DIRECT_URL ? withSchema(process.env.DIRECT_URL) : testUrl;

// Важно: подменяем окружение ДО импорта приложения — Prisma и Telegraf читают
// его на старте модуля. dotenv существующие переменные не перезаписывает.
process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testDirectUrl;
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1'; // приложение не слушает порт и не поднимает polling — слушаем сами
process.env.ALLOW_BROWSER_DEMO = 'true'; // без Telegram initData, как гость
process.env.YOOKASSA_MODE = 'mock';
process.env.YOOKASSA_SHOP_ID = '';
process.env.YOOKASSA_SECRET_KEY = '';
process.env.BOT_TOKEN = '0:e2e-dummy-token';
process.env.ADMIN_IDS = '';
process.env.PUBLIC_URL = `http://localhost:${PORT}`;
process.env.WEBAPP_URL = `http://localhost:${PORT}`;

const { PrismaClient } = await import('@prisma/client');
const admin = new PrismaClient({ datasources: { db: { url: testDirectUrl } } });

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

let server;

try {
  console.log(`\n1. Готовим временную схему ${SCHEMA}`);
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`);

  const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testDirectUrl },
    encoding: 'utf8',
    shell: true,
  });
  const migrateOk = migrate.status === 0;
  check('prisma migrate deploy на чистой схеме', migrateOk, migrateOk ? '' : (migrate.stderr || '').slice(0, 200));
  if (!migrateOk) throw new Error('миграции не применились');

  console.log('\n2. Тестовый товар и промокод');
  const product = await admin.product.create({
    data: {
      name: 'E2E Candle', slug: 'e2e-candle-' + Date.now(), description: 'тест',
      price: 200000, category: 'Тест', images: JSON.stringify(['/images/candle_1.jpg']),
    },
  });
  await admin.promoCode.create({
    data: { code: 'E2E10', discountType: 'PERCENT', discountValue: 10, usageLimit: 5 },
  });
  check('товар создан', Boolean(product.id));

  console.log('\n3. Поднимаем приложение');
  const { default: app } = await import('../dist/index.js');
  server = app.listen(PORT);
  await new Promise((resolve) => server.once('listening', resolve));

  const api = `http://localhost:${PORT}/api`;
  const post = async (path, body) => {
    const res = await fetch(api + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };
  const get = async (path) => {
    const res = await fetch(api + path);
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };

  const health = await fetch(`http://localhost:${PORT}/health`).then((r) => r.json());
  check('/health отвечает и база живая', health.status === 'ok' && health.db === 'up', `режим оплаты: ${health.payments?.mode}`);

  const delivery = await get('/orders/delivery-options');
  check('справочник доставки', delivery.status === 200 && delivery.json.options?.length > 0,
    `${delivery.json.options?.length} способов, бесплатно от ${delivery.json.freeFrom} ₽`);

  console.log('\n4. Проверки валидации заказа');
  const noConsent = await post('/orders', {
    items: [{ productId: product.id, qty: 1 }],
    userName: 'Тест Тестов', userPhone: '+7 999 123-45-67',
    deliveryMethod: 'CDEK', userCity: 'Москва', userAddress: 'ул. Тестовая, 1',
  });
  check('заказ без согласия на ПДн отклонён', noConsent.status === 400, noConsent.json.error);

  const noAddress = await post('/orders', {
    items: [{ productId: product.id, qty: 1 }],
    userName: 'Тест Тестов', userPhone: '+7 999 123-45-67',
    deliveryMethod: 'CDEK', consent: true,
  });
  check('СДЭК без адреса отклонён', noAddress.status === 400, noAddress.json.error);

  const pickup = await post('/orders', {
    items: [{ productId: product.id, qty: 1 }],
    userName: 'Тест Тестов', userPhone: '+7 999 123-45-67',
    deliveryMethod: 'PICKUP', consent: true, paymentType: 'MANUAL',
  });
  check('самовывоз без адреса принят', pickup.status === 201, `доставка ${pickup.json.deliveryPrice} ₽`);

  console.log('\n5. Заказ с промокодом и онлайн-оплатой');
  const created = await post('/orders', {
    items: [{ productId: product.id, qty: 2 }],
    userName: 'Тест Тестов', userPhone: '+7 999 123-45-67',
    userCity: 'Москва', userAddress: 'ул. Тестовая, 1', userPostal: '101000',
    deliveryMethod: 'CDEK', comment: 'e2e', promoCode: 'e2e10',
    paymentType: 'ONLINE', consent: true,
  });
  const order = created.json;
  // 2 × 2000 ₽ = 4000, скидка 10% = 400, доставка СДЭК 350 → 3950
  const mathOk = order.itemsTotal === 4000 && order.discount === 400 && order.deliveryPrice === 350 && order.totalPrice === 3950;
  check('заказ создан, суммы посчитаны сервером', created.status === 201 && mathOk,
    `товары ${order.itemsTotal} − скидка ${order.discount} + доставка ${order.deliveryPrice} = ${order.totalPrice} ₽`);

  const promoAfter = await admin.promoCode.findUnique({ where: { code: 'E2E10' } });
  check('счётчик промокода увеличен в транзакции', promoAfter?.usageCount === 1);

  console.log('\n6. Оплата (эмулятор)');
  const payment = await post('/payments/create', { orderId: order.id });
  check('платёж создан', payment.status === 200 && Boolean(payment.json.paymentId),
    payment.status === 200
      ? `${payment.json.amount} ₽, mock=${payment.json.mock}`
      : `HTTP ${payment.status}: ${JSON.stringify(payment.json).slice(0, 200)}`);

  const beforePay = await get(`/payments/status/${order.id}`);
  check('до оплаты статус PENDING', beforePay.json.paymentStatus === 'PENDING');

  const paid = await post(`/payments/mock/${payment.json.paymentId}/succeeded`, {});
  check('оплата подтверждена', paid.status === 200, JSON.stringify(paid.json).slice(0, 120));

  const afterPay = await get(`/payments/status/${order.id}`);
  check('заказ помечен оплаченным', afterPay.json.paymentStatus === 'PAID',
    `статус заказа ${afterPay.json.status}, способ ${afterPay.json.paymentMethod}`);

  const events = await admin.paymentEvent.count();
  check('уведомление записано в журнал (идемпотентность)', events >= 1, `${events} событие(й)`);

  // Повторное подтверждение не должно ломать заказ и плодить события.
  await post(`/payments/mock/${payment.json.paymentId}/succeeded`, {});
  const eventsAfter = await admin.paymentEvent.count();
  const stillPaid = await get(`/payments/status/${order.id}`);
  check('повторное уведомление не дублируется', eventsAfter === events && stillPaid.json.paymentStatus === 'PAID',
    `событий ${eventsAfter}`);

  console.log('\n7. Доступ к чужим данным и правам');
  const foreign = await admin.order.create({
    data: {
      telegramUserId: BigInt(123456789), userName: 'Чужой', items: JSON.stringify([]),
      totalPrice: 100, itemsTotal: 100,
    },
  });
  const foreignStatus = await get(`/payments/status/${foreign.id}`);
  check('чужой заказ не отдаётся', foreignStatus.status === 403, foreignStatus.json.error);

  const patch = await fetch(`${api}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'DONE' }),
  });
  check('смена статуса заказа закрыта от не-админа', patch.status === 403);

  const badProduct = await fetch(`${api}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x', slug: 'x', price: 1, category: 'x' }),
  });
  check('создание товара закрыто от не-админа', badProduct.status === 403);

  const orders = await get('/orders');
  const onlyMine = Array.isArray(orders.json) && orders.json.every((o) => o.userName !== 'Чужой');
  check('в списке заказов только свои', onlyMine, `видно ${orders.json.length} заказ(ов)`);
} catch (error) {
  console.error('\nОШИБКА:', error?.message);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {});
  await admin.$disconnect();

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nИтог: ${checks.length - failed.length}/${checks.length} проверок пройдено`);
  if (failed.length) {
    console.log('Провалились:', failed.map((f) => f.name).join('; '));
    process.exitCode = 1;
  }
  // Приложение держит открытым пул Prisma — выходим явно.
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}



