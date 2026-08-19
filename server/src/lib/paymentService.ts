// Платёжный домен: создание платежа по заказу, применение статусов из
// уведомлений ЮKassa и уведомления в Telegram. Единая точка входа и для
// реального API, и для встроенного эмулятора — вебхук, ручное подтверждение
// в эмуляторе и опрос статуса приводят заказ в одно и то же состояние.

import { randomUUID } from 'crypto';
import { prisma } from './prisma.js';
import * as yoo from './yookassa.js';
import { bot } from './bot.js';

export type OrderPaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'CANCELED' | 'REFUNDED';

/** Статус платежа ЮKassa → статус оплаты заказа. */
export function mapYooStatus(status: yoo.PaymentStatus): OrderPaymentStatus {
  switch (status) {
    case 'succeeded':
      return 'PAID';
    case 'canceled':
      return 'CANCELED';
    case 'pending':
    case 'waiting_for_capture':
    default:
      return 'PENDING';
  }
}

/** Публичный адрес бэкенда — нужен эмулятору и как fallback для return_url. */
export function publicApiUrl(): string {
  const raw = process.env.PUBLIC_URL || process.env.WEBAPP_URL || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/**
 * Куда вернуть пользователя после оплаты. В Telegram правильнее вести назад в
 * Mini App по прямой ссылке — тогда после оплаты в браузере человек попадает
 * обратно в приложение и видит статус заказа.
 */
export function buildReturnUrl(orderId: number): string {
  const botUsername = process.env.BOT_USERNAME;
  if (botUsername) {
    const appName = process.env.BOT_APP_NAME;
    const base = appName ? `https://t.me/${botUsername}/${appName}` : `https://t.me/${botUsername}`;
    return `${base}?startapp=paid-${orderId}`;
  }
  return `${publicApiUrl()}/?paid=${orderId}`;
}

/**
 * Чек по 54-ФЗ. Отправляется только если магазин к этому готов
 * (YOOKASSA_SEND_RECEIPT=true) — у тестового магазина без подключённой кассы
 * запрос с чеком отклоняется, поэтому по умолчанию выключено.
 */
function buildReceipt(order: { userPhone: string; items: string; totalPrice: number }) {
  if (process.env.YOOKASSA_SEND_RECEIPT !== 'true') return undefined;

  const phone = order.userPhone.replace(/\D/g, '');
  const items: yoo.ReceiptItem[] = (JSON.parse(order.items) as Array<{
    name: string;
    price: number;
    qty: number;
  }>).map((item) => ({
    description: item.name.slice(0, 128),
    quantity: item.qty,
    amount: { value: yoo.toAmountValue(item.price), currency: 'RUB' },
    vat_code: Number(process.env.YOOKASSA_VAT_CODE || 1), // 1 = без НДС
    payment_mode: 'full_payment',
    payment_subject: 'commodity',
  }));

  return { customer: phone ? { phone } : {}, items };
}

export interface StartPaymentResult {
  paymentId: string;
  /** Токен инициализации виджета — основной путь (оплата внутри Mini App). */
  confirmationToken?: string;
  /** Ссылка на страницу оплаты — эмулятор и запрошенный явно redirect. */
  confirmationUrl?: string;
  status: OrderPaymentStatus;
  mock: boolean;
  test: boolean;
  amount: number; // в рублях
}

/**
 * Создаёт (или переиспользует) платёж по заказу.
 *
 * По умолчанию делает embedded-платёж: возвращает `confirmationToken`, по
 * которому приложение рисует форму ЮKassa у себя — пользователь не покидает
 * Telegram. `redirect` оставлен для эмулятора и оплаты вне Mini App.
 *
 * Повторный вызов по заказу с живым платежом не создаёт второй платёж, если
 * прежний ещё можно показать. Если показать нельзя (для embedded ЮKassa не
 * отдаёт токен повторно), старый платёж отменяется и создаётся новый — деньги
 * при этом не задваиваются: незавершённый платёж списанием не является.
 */
export async function startPaymentForOrder(
  orderId: number,
  confirmation: yoo.ConfirmationType = 'embedded',
): Promise<StartPaymentResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw Object.assign(new Error('Заказ не найден'), { status: 404 });
  if (order.paymentStatus === 'PAID') {
    throw Object.assign(new Error('Заказ уже оплачен'), { status: 409 });
  }
  if (order.totalPrice <= 0) {
    throw Object.assign(new Error('Нулевая сумма — оплата не требуется'), { status: 400 });
  }

  const wantEmbedded = confirmation === 'embedded' && !yoo.isMockMode();

  // Живой платёж переиспользуем, чтобы двойной вызов не плодил платежи.
  if (order.paymentId && order.paymentStatus === 'PENDING') {
    const existing = await readPayment(order.paymentId, order.totalPrice);
    const reusable = existing?.status === 'PENDING'
      && Boolean(wantEmbedded ? existing.confirmationToken : existing.confirmationUrl);

    if (reusable) {
      return {
        paymentId: order.paymentId,
        confirmationToken: wantEmbedded ? existing!.confirmationToken : undefined,
        confirmationUrl: wantEmbedded ? undefined : existing!.confirmationUrl,
        status: 'PENDING',
        mock: yoo.isMockMode(),
        test: yoo.isTestShop(),
        amount: order.totalPrice / 100,
      };
    }

    // Показать прежний платёж нечем — отменяем, чтобы не оставлять висящий
    // pending в кабинете ЮKassa. Ошибку отмены не считаем фатальной.
    if (existing?.status === 'PENDING' && !order.paymentId.startsWith('mock-')) {
      try {
        await yoo.cancelPayment(order.paymentId, randomUUID());
        console.log(`[payments] заказ #${order.id}: прежний платёж ${order.paymentId} отменён перед новым`);
      } catch (error) {
        console.warn('[payments] не удалось отменить прежний платёж', order.paymentId, error);
      }
    }
  }

  const description = `Заказ №${order.id} · MISHKIN`;
  let paymentId: string;
  let confirmationUrl: string | undefined;
  let confirmationToken: string | undefined;

  if (yoo.isMockMode()) {
    paymentId = `mock-${randomUUID()}`;
    confirmationUrl = `${publicApiUrl()}/api/payments/mock/${paymentId}`;
  } else {
    const payment = await yoo.createPayment({
      amountKopecks: order.totalPrice,
      description,
      confirmation: wantEmbedded ? 'embedded' : 'redirect',
      returnUrl: wantEmbedded ? undefined : buildReturnUrl(order.id),
      idempotenceKey: randomUUID(),
      metadata: { orderId: String(order.id) },
      receipt: buildReceipt(order),
      paymentMethodType: process.env.YOOKASSA_PAYMENT_METHOD || undefined,
    });
    paymentId = payment.id;

    if (wantEmbedded) {
      confirmationToken = payment.confirmation?.confirmation_token;
      if (!confirmationToken) {
        throw Object.assign(new Error('ЮKassa не вернула токен для формы оплаты'), { status: 502 });
      }
    } else {
      confirmationUrl = payment.confirmation?.confirmation_url;
      if (!confirmationUrl) {
        throw Object.assign(new Error('ЮKassa не вернула ссылку на оплату'), { status: 502 });
      }
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentId, paymentStatus: 'PENDING', paymentType: 'ONLINE' },
  });

  return {
    paymentId,
    confirmationToken,
    confirmationUrl,
    status: 'PENDING',
    mock: yoo.isMockMode(),
    test: yoo.isTestShop(),
    amount: order.totalPrice / 100,
  };
}

interface ReadPaymentResult {
  status: OrderPaymentStatus;
  confirmationUrl?: string;
  confirmationToken?: string;
  methodType?: string;
  amountKopecks?: number;
}

/**
 * Актуальное состояние платежа. В mock-режиме источник истины — сам заказ
 * (эмулятор не хранит отдельного состояния, поэтому переживает перезапуск).
 */
async function readPayment(paymentId: string, _expectedKopecks: number): Promise<ReadPaymentResult | null> {
  if (paymentId.startsWith('mock-')) {
    const order = await prisma.order.findUnique({ where: { paymentId } });
    if (!order) return null;
    return {
      status: order.paymentStatus as OrderPaymentStatus,
      confirmationUrl: `${publicApiUrl()}/api/payments/mock/${paymentId}`,
      methodType: order.paymentMethod || undefined,
      amountKopecks: order.totalPrice,
    };
  }

  try {
    const payment = await yoo.getPayment(paymentId);
    return {
      status: mapYooStatus(payment.status),
      confirmationUrl: payment.confirmation?.confirmation_url,
      confirmationToken: payment.confirmation?.confirmation_token,
      methodType: payment.payment_method?.type,
      amountKopecks: yoo.fromAmountValue(payment.amount.value),
    };
  } catch (error) {
    console.error('[payments] не удалось получить платёж', paymentId, error);
    return null;
  }
}

export interface ApplyResult {
  applied: boolean;
  duplicate: boolean;
  orderId?: number;
  paymentStatus?: OrderPaymentStatus;
  reason?: string;
}

/**
 * Применяет состояние платежа к заказу. Идемпотентно: повторная доставка того
 * же уведомления не задвоит побочные эффекты (ЮKassa ретраит 24 часа).
 */
export async function applyPaymentStatus(params: {
  paymentId: string;
  status: OrderPaymentStatus;
  event: string;
  methodType?: string;
  amountKopecks?: number;
  payload?: unknown;
}): Promise<ApplyResult> {
  const { paymentId, status, event, methodType, amountKopecks } = params;

  const order = await prisma.order.findUnique({ where: { paymentId } });
  if (!order) {
    return { applied: false, duplicate: false, reason: 'Заказ с таким платежом не найден' };
  }

  // Сумма из уведомления должна совпасть с суммой заказа — иначе не считаем оплаченным.
  if (status === 'PAID' && typeof amountKopecks === 'number' && amountKopecks !== order.totalPrice) {
    console.error(
      `[payments] сумма не совпала: заказ #${order.id} ожидает ${order.totalPrice}, платёж ${amountKopecks}`,
    );
    return { applied: false, duplicate: false, orderId: order.id, reason: 'Сумма платежа не совпадает с заказом' };
  }

  const eventKey = `${event}:${paymentId}:${status}`;
  try {
    await prisma.paymentEvent.create({
      data: {
        eventKey,
        paymentId,
        event,
        status,
        amount: amountKopecks ?? order.totalPrice,
        payload: JSON.stringify(params.payload ?? {}).slice(0, 8000),
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { applied: false, duplicate: true, orderId: order.id, paymentStatus: order.paymentStatus as OrderPaymentStatus };
    }
    throw error;
  }

  const data: Record<string, unknown> = { paymentStatus: status };
  if (methodType) data.paymentMethod = methodType;
  if (status === 'PAID') {
    data.paidAt = new Date();
    // Оплаченный заказ автоматически уходит из «Новый» в «Подтверждён».
    if (order.status === 'NEW') data.status = 'CONFIRMED';
  }

  const updated = await prisma.order.update({ where: { id: order.id }, data });

  if (status === 'PAID' && order.paymentStatus !== 'PAID') {
    void notifyPaid(updated);
  }

  return { applied: true, duplicate: false, orderId: order.id, paymentStatus: status };
}

/**
 * Перезапрашивает статус у ЮKassa и применяет его. Используется и как проверка
 * подлинности уведомления, и как опрос из приложения, если вебхук не дошёл.
 */
export async function syncPaymentStatus(paymentId: string): Promise<ApplyResult & { status?: OrderPaymentStatus }> {
  const order = await prisma.order.findUnique({ where: { paymentId } });
  if (!order) return { applied: false, duplicate: false, reason: 'Заказ с таким платежом не найден' };

  const actual = await readPayment(paymentId, order.totalPrice);
  if (!actual) return { applied: false, duplicate: false, orderId: order.id, reason: 'Платёж недоступен' };

  if (actual.status === order.paymentStatus) {
    return { applied: false, duplicate: true, orderId: order.id, status: actual.status, paymentStatus: actual.status };
  }

  const result = await applyPaymentStatus({
    paymentId,
    status: actual.status,
    event: 'sync',
    methodType: actual.methodType,
    amountKopecks: actual.amountKopecks,
  });
  return { ...result, status: actual.status };
}

/** Подтверждение/отклонение платежа в эмуляторе. */
export async function resolveMockPayment(
  paymentId: string,
  outcome: 'succeeded' | 'canceled',
  methodType = 'bank_card',
): Promise<ApplyResult> {
  if (!paymentId.startsWith('mock-')) {
    throw Object.assign(new Error('Это не платёж эмулятора'), { status: 400 });
  }
  const order = await prisma.order.findUnique({ where: { paymentId } });
  if (!order) throw Object.assign(new Error('Заказ не найден'), { status: 404 });

  return applyPaymentStatus({
    paymentId,
    status: outcome === 'succeeded' ? 'PAID' : 'CANCELED',
    event: `mock.payment.${outcome}`,
    methodType,
    amountKopecks: order.totalPrice,
    payload: { emulator: true, outcome },
  });
}

function adminIds(): number[] {
  return (process.env.ADMIN_IDS || '')
    .replace(/["']/g, '')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => Number.isFinite(id) && id > 0);
}

const rub = (kopecks: number) => (kopecks / 100).toLocaleString('ru-RU');

/** Сообщаем менеджеру и клиенту, что заказ оплачен. */
async function notifyPaid(order: {
  id: number;
  telegramUserId: bigint;
  userName: string;
  totalPrice: number;
  paymentMethod: string;
  tgUsername: string | null;
}): Promise<void> {
  const method = order.paymentMethod ? ` (${order.paymentMethod})` : '';
  const adminText =
    `💳 *Заказ #${order.id} оплачен*\n\n` +
    `👤 ${order.userName}${order.tgUsername ? ` (@${order.tgUsername})` : ''}\n` +
    `💰 Сумма: ${rub(order.totalPrice)} ₽${method}\n` +
    (yoo.isTestShop() ? `\n⚠️ Тестовый контур — реальных денег нет.` : '');

  for (const adminId of adminIds()) {
    try {
      await bot.telegram.sendMessage(adminId, adminText, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[payments] не удалось уведомить админа', adminId, error);
    }
  }

  try {
    await bot.telegram.sendMessage(
      order.telegramUserId.toString(),
      `✅ Оплата получена!\n\nЗаказ №${order.id} на ${rub(order.totalPrice)} ₽ оплачен и передан в работу. ` +
        `Мы свяжемся с вами по доставке.\n\nСпасибо, что выбрали MISHKIN 🕯`,
    );
  } catch (error) {
    // Клиент мог не запускать бота или заблокировать его — это не ошибка оплаты.
    console.warn('[payments] клиенту сообщить не удалось', order.telegramUserId.toString(), error);
  }
}

/** Уведомление клиента о смене статуса заказа и трек-номере (вызывается из админки). */
export async function notifyOrderStatus(
  telegramUserId: bigint,
  orderId: number,
  status: string,
  trackNumber?: string,
  deliveryMethod?: string,
): Promise<void> {
  const labels: Record<string, string> = {
    NEW: 'принят',
    CONFIRMED: 'подтверждён и передан в сборку',
    SHIPPED: 'отправлен',
    DONE: 'доставлен',
    CANCELLED: 'отменён',
  };
  const label = labels[status] || status;

  let text = `📦 *Заказ №${orderId} ${label}!*\n`;

  if (status === 'SHIPPED') {
    text += `\n🚚 Ваш заказ уже в пути!`;
    if (deliveryMethod) {
      text += `\n📦 Доставка: *${deliveryMethod}*`;
    }
    if (trackNumber) {
      text += `\n🔎 Трек-номер для отслеживания: \`${trackNumber}\``;
    }
  } else if (trackNumber) {
    text += `\n🔎 Трек-номер для отслеживания: \`${trackNumber}\``;
  }

  if (status === 'DONE') {
    text += `\n✨ Спасибо за покупку в MISHKIN! Будем рады вашим отзывам и новым заказам.`;
  }

  try {
    await bot.telegram.sendMessage(
      telegramUserId.toString(),
      text,
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    console.warn('[payments] статус/трек клиенту не доставлен', telegramUserId.toString(), error);
  }
}
