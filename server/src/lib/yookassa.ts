// Клиент ЮKassa API v3 (https://yookassa.ru/developers/api).
//
// Работает в двух режимах:
//   real — реальные запросы к api.yookassa.ru (тестовый или боевой магазин
//          определяется тем, какие ключи лежат в env: test_… или live_…);
//   mock — встроенный эмулятор: платёж не уходит наружу, а подтверждается
//          вручную на локальной странице. Нужен, чтобы гонять сквозной поток
//          «заказ → оплата → уведомление → статус Оплачен» без реквизитов.
//
// Режим выбирается автоматически: если ключей нет — включается эмулятор.
// Принудительно: YOOKASSA_MODE=mock | real.

import { randomUUID } from 'crypto';

const API_BASE = 'https://api.yookassa.ru/v3';

export type PaymentStatus = 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';

export interface YooAmount {
  value: string;
  currency: string;
}

export interface YooPayment {
  id: string;
  status: PaymentStatus;
  paid: boolean;
  amount: YooAmount;
  description?: string;
  test?: boolean;
  metadata?: Record<string, string>;
  payment_method?: { type?: string; title?: string };
  confirmation?: { type: string; confirmation_url?: string };
  cancellation_details?: { party?: string; reason?: string };
  created_at?: string;
}

export interface ReceiptItem {
  description: string;
  quantity: number;
  amount: YooAmount;
  vat_code: number;
  payment_mode?: string;
  payment_subject?: string;
}

const shopId = () => (process.env.YOOKASSA_SHOP_ID || '').trim();
const secretKey = () => (process.env.YOOKASSA_SECRET_KEY || '').trim();

/** Есть ли реквизиты для реальных запросов к ЮKassa. */
export function hasCredentials(): boolean {
  return Boolean(shopId() && secretKey());
}

/** Работаем через встроенный эмулятор вместо реального API. */
export function isMockMode(): boolean {
  const mode = (process.env.YOOKASSA_MODE || 'auto').toLowerCase();
  if (mode === 'mock') return true;
  if (mode === 'real') return false;
  return !hasCredentials();
}

/** Тестовый контур (ключ начинается на test_) — показываем в UI, чтобы не путать с боевым. */
export function isTestShop(): boolean {
  return isMockMode() || secretKey().startsWith('test_');
}

export function describeMode(): { mode: 'mock' | 'real'; test: boolean; shopId: string } {
  return {
    mode: isMockMode() ? 'mock' : 'real',
    test: isTestShop(),
    // shopId не секретный, но обрезаем — в логи попадает только хвост
    shopId: shopId() ? `…${shopId().slice(-4)}` : '',
  };
}

/** Копейки → строка в формате ЮKassa: 280000 → "2800.00". */
export function toAmountValue(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}

/** "2800.00" → 280000 */
export function fromAmountValue(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

class YooKassaError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'YooKassaError';
    this.status = status;
    this.code = code;
  }
}

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  idempotenceKey?: string,
): Promise<T> {
  if (!hasCredentials()) {
    throw new YooKassaError('YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY не заданы', 500);
  }

  const auth = Buffer.from(`${shopId()}:${secretKey()}`).toString('base64');
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') {
    headers['Idempotence-Key'] = idempotenceKey || randomUUID();
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* не JSON — отдадим как есть в сообщении об ошибке */
  }

  if (!res.ok) {
    const description = json?.description || json?.error || text || res.statusText;
    throw new YooKassaError(`ЮKassa ${res.status}: ${description}`, res.status, json?.code);
  }

  return json as T;
}

export interface CreatePaymentInput {
  amountKopecks: number;
  description: string;
  returnUrl: string;
  /** Ключ идемпотентности — один и тот же заказ не создаст два платежа. */
  idempotenceKey: string;
  metadata?: Record<string, string>;
  receipt?: { customer: { phone?: string; email?: string }; items: ReceiptItem[] };
  /** Ограничить способ оплаты, например 'sbp'. По умолчанию — выбор на стороне ЮKassa. */
  paymentMethodType?: string;
}

export async function createPayment(input: CreatePaymentInput): Promise<YooPayment> {
  const body: Record<string, unknown> = {
    amount: { value: toAmountValue(input.amountKopecks), currency: 'RUB' },
    capture: true, // одностадийный платёж: деньги списываются сразу
    confirmation: { type: 'redirect', return_url: input.returnUrl },
    description: input.description.slice(0, 128),
  };
  if (input.metadata) body.metadata = input.metadata;
  if (input.receipt) body.receipt = input.receipt;
  if (input.paymentMethodType) body.payment_method_data = { type: input.paymentMethodType };

  return call<YooPayment>('POST', '/payments', body, input.idempotenceKey);
}

export async function getPayment(paymentId: string): Promise<YooPayment> {
  return call<YooPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

export async function cancelPayment(paymentId: string, idempotenceKey: string): Promise<YooPayment> {
  return call<YooPayment>('POST', `/payments/${encodeURIComponent(paymentId)}/cancel`, {}, idempotenceKey);
}

export async function createRefund(
  paymentId: string,
  amountKopecks: number,
  idempotenceKey: string,
  description?: string,
): Promise<{ id: string; status: string }> {
  return call('POST', '/refunds', {
    payment_id: paymentId,
    amount: { value: toAmountValue(amountKopecks), currency: 'RUB' },
    ...(description ? { description } : {}),
  }, idempotenceKey);
}

export { YooKassaError };
