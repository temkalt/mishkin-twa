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
import { createHmac } from 'node:crypto';

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

// Подпись initData ровно по схеме Telegram: ключ — HMAC от строки «WebAppData»
// на токене бота. Токен здесь заглушка и известен скрипту, поэтому подпись
// собирается локально и запрос проходит validateTelegram по-настоящему.
//
// Раньше админские вызовы шли гостевым путём (ADMIN_IDS='0' на id гостя), и
// подписанная ветка авторизации не проверялась вообще. Теперь нулевой id
// админом не считается (lib/admins.ts) — иначе браузерное демо открывало бы
// админку, — так что тест обязан предъявить настоящую подпись.
const signInitData = (fields) => {
  const params = new URLSearchParams(fields);
  params.sort();
  const dataCheckString = [...params].map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));
  return params.toString();
};

const ADMIN_ID = 777000777;
const ADMIN_USER = { id: ADMIN_ID, first_name: 'E2E Админ', username: 'e2e_admin' };
const adminInitData = () =>
  signInitData({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(ADMIN_USER) });

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

  // В эмуляторе платёж всегда redirect: клиенту нужна ссылка, а не токен
  // виджета. Проверяем явно — фронт выбирает путь именно по этим полям.
  check('эмулятор вернул ссылку на оплату, а не токен виджета',
    Boolean(payment.json.confirmationUrl) && !payment.json.confirmationToken,
    `url=${Boolean(payment.json.confirmationUrl)}, token=${Boolean(payment.json.confirmationToken)}`);

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

  // Сама авторизация: до этого тест ходил только гостевым путём (демо-режим),
  // и подписанная ветка не проверялась ни разу.
  const authGet = (initData) => fetch(`${api}/orders`, { headers: { 'X-Telegram-Init-Data': initData } });

  const signed = await authGet(adminInitData());
  check('подписанный initData принят', signed.status === 200);

  const tampered = adminInitData().replace(/hash=[0-9a-f]+/, `hash=${'0'.repeat(64)}`);
  check('подделанная подпись отклонена', (await authGet(tampered)).status === 401);

  // auth_date обязателен: без отметки времени перехваченный initData жил бы вечно.
  const noAuthDate = signInitData({ user: JSON.stringify(ADMIN_USER) });
  check('initData без auth_date отклонён', (await authGet(noAuthDate)).status === 401);

  const expired = signInitData({
    auth_date: String(Math.floor(Date.now() / 1000) - 86_400 - 60),
    user: JSON.stringify(ADMIN_USER),
  });
  check('просроченный initData отклонён (>24 ч)', (await authGet(expired)).status === 401);

  // Ноль в ADMIN_IDS (лишняя запятая, пустое значение) не должен открывать
  // админку гостю браузерного демо — он приходит именно с id = 0.
  process.env.ADMIN_IDS = '0';
  const zeroAdmin = await fetch(`${api}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'DONE' }),
  });
  process.env.ADMIN_IDS = '';
  check('ADMIN_IDS=0 не делает админом гостя', zeroAdmin.status === 403);

  console.log('\n8. Склад: списание, нехватка и возврат при отмене');
  const limited = await admin.product.create({
    data: {
      name: 'E2E Limited', slug: 'e2e-limited-' + Date.now(), description: 'тест склада',
      price: 100000, category: 'Тест', images: JSON.stringify([]), stock: 3,
    },
  });
  const stockOf = async (id) => (await admin.product.findUnique({ where: { id } }))?.stock;
  /** Самовывоз + оплата «при получении»: короткий путь без адреса и платежа. */
  const buy = (productId, qty) => post('/orders', {
    items: [{ productId, qty }],
    userName: 'Тест Тестов', userPhone: '+7 999 123-45-67',
    deliveryMethod: 'PICKUP', consent: true, paymentType: 'MANUAL',
  });

  const tooMany = await buy(limited.id, 5);
  check('заказ больше остатка отклонён', tooMany.status === 409, tooMany.json.error);
  check('отклонённый заказ остаток не тронул', (await stockOf(limited.id)) === 3);

  const firstBuy = await buy(limited.id, 2);
  const afterFirst = await stockOf(limited.id);
  check('остаток списан в транзакции заказа', firstBuy.status === 201 && afterFirst === 1, `осталось ${afterFirst}`);

  const overLimit = await buy(limited.id, 2);
  check('второй заказ на остаток 1 отклонён', overLimit.status === 409, overLimit.json.error);

  const lastOne = await buy(limited.id, 1);
  const afterLast = await stockOf(limited.id);
  check('последняя штука продана, остаток 0', lastOne.status === 201 && afterLast === 0, `осталось ${afterLast}`);

  const soldOut = await buy(limited.id, 1);
  check('товар с нулевым остатком не продаётся', soldOut.status === 409, soldOut.json.error);

  const catalog = await get('/products');
  const listed = Array.isArray(catalog.json) ? catalog.json.find((p) => p.id === limited.id) : null;
  check('каталог отдаёт остаток фронту', listed?.stock === 0, `stock=${listed?.stock}`);

  // Отмену делает подписанный админ: ADMIN_IDS читается на каждом запросе,
  // поэтому его id добавляется в переменную ровно на эти два вызова.
  const cancel = async (orderId) => {
    process.env.ADMIN_IDS = String(ADMIN_ID);
    try {
      return await fetch(`${api}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': adminInitData(),
        },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
    } finally {
      process.env.ADMIN_IDS = '';
    }
  };

  const cancelled = await cancel(firstBuy.json.id);
  const afterCancel = await stockOf(limited.id);
  check('отмена заказа вернула 2 шт. на склад', cancelled.status === 200 && afterCancel === 2, `осталось ${afterCancel}`);

  await cancel(firstBuy.json.id);
  const afterTwice = await stockOf(limited.id);
  check('повторная отмена остаток не задваивает', afterTwice === 2, `осталось ${afterTwice}`);

  const unlimited = await buy(product.id, 40);
  check('товар без учёта склада не ограничен', unlimited.status === 201 && (await stockOf(product.id)) === null);
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



