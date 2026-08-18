// Роуты оплаты.
//
// Разделены на два роутера, потому что уведомления ЮKassa и страница
// эмулятора приходят БЕЗ Telegram initData — их нельзя вешать за
// validateTelegram. Публичный роутер монтируется в index.ts раньше проверки.

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import * as yoo from '../lib/yookassa.js';
import {
  startPaymentForOrder,
  syncPaymentStatus,
  resolveMockPayment,
  applyPaymentStatus,
  buildReturnUrl,
} from '../lib/paymentService.js';
import { isYooKassaIp, clientIp } from '../lib/ipAllowlist.js';
import { renderMockCheckout } from '../lib/mockCheckoutPage.js';

export const paymentsPublicRouter = Router();
export const paymentsRouter = Router();

const rub = (kopecks: number) => (kopecks / 100).toLocaleString('ru-RU');

// ---------------------------------------------------------------------------
// ПУБЛИЧНОЕ: уведомления ЮKassa
// ---------------------------------------------------------------------------

/**
 * POST /api/payments/webhook — HTTP-уведомление от ЮKassa.
 *
 * Подлинность проверяем дважды: по IP отправителя и — главное — перезапросом
 * статуса через API (подделать ответ api.yookassa.ru нельзя).
 * https://yookassa.ru/developers/using-api/webhooks
 */
paymentsPublicRouter.post('/webhook', async (req, res) => {
  const ip = clientIp(req.headers as Record<string, unknown>, req.ip);

  if (process.env.YOOKASSA_WEBHOOK_CHECK_IP !== 'false' && !isYooKassaIp(ip)) {
    console.warn('[payments] уведомление с посторонного IP отклонено:', ip);
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { type, event, object } = (req.body || {}) as {
    type?: string;
    event?: string;
    object?: { id?: string; payment_id?: string };
  };

  if (type !== 'notification' || !event || !object) {
    res.status(400).json({ error: 'Bad notification format' });
    return;
  }

  try {
    if (event.startsWith('payment.') && object.id) {
      const result = await syncPaymentStatus(object.id);
      console.log(`[payments] ${event} → заказ #${result.orderId ?? '?'}: ${result.paymentStatus ?? result.reason}`);
    } else if (event === 'refund.succeeded' && object.payment_id) {
      await applyPaymentStatus({
        paymentId: object.payment_id,
        status: 'REFUNDED',
        event,
        payload: object,
      });
    }
    // 200 обязателен, иначе ЮKassa будет ретраить сутки.
    res.status(200).json({ received: true });
  } catch (error) {
    // Возвращаем 500 осознанно — пусть уведомление придёт повторно.
    console.error('[payments] ошибка обработки уведомления:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// ---------------------------------------------------------------------------
// ПУБЛИЧНОЕ: страница эмулятора
// ---------------------------------------------------------------------------

/** GET /api/payments/mock/:paymentId — страница «оплаты» вместо ЮKassa. */
paymentsPublicRouter.get('/mock/:paymentId', async (req, res) => {
  const paymentId = String(req.params.paymentId);
  const order = await prisma.order.findUnique({ where: { paymentId } });

  if (!order) {
    res.status(404).type('html').send('<h1>Платёж не найден</h1>');
    return;
  }

  const done = req.query.done === 'succeeded' ? 'PAID' : req.query.done === 'canceled' ? 'CANCELED' : null;

  res.type('html').send(
    renderMockCheckout({
      paymentId,
      orderId: order.id,
      amountRub: rub(order.totalPrice),
      returnUrl: buildReturnUrl(order.id),
      status: (done || order.paymentStatus) as 'PENDING' | 'PAID' | 'CANCELED',
    }),
  );
});

/** POST /api/payments/mock/:paymentId/:outcome — подтвердить или отклонить. */
paymentsPublicRouter.post('/mock/:paymentId/:outcome', async (req, res) => {
  const outcome = req.params.outcome === 'succeeded' ? 'succeeded' : 'canceled';
  try {
    const result = await resolveMockPayment(String(req.params.paymentId), outcome);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(error?.status || 500).json({ error: error?.message || 'Не удалось обработать' });
  }
});

// ---------------------------------------------------------------------------
// ЗА АВТОРИЗАЦИЕЙ: работа с платежом из приложения
// ---------------------------------------------------------------------------

/** Заказ принадлежит текущему пользователю (или он админ). */
function ownsOrder(req: { telegramUser?: { id: number } }, telegramUserId: bigint): boolean {
  const userId = req.telegramUser?.id;
  // Именно !== undefined: у гостя в демо-режиме id равен 0, а `!userId`
  // отсекал его вместе с отсутствующим пользователем — гость мог создать
  // заказ, но не мог его оплатить.
  if (userId === undefined) return false;
  if (BigInt(userId) === telegramUserId) return true;

  const admins = (process.env.ADMIN_IDS || '').replace(/["']/g, '').split(',').map((id) => id.trim());
  return admins.includes(String(userId));
}

/** GET /api/payments/config — что показывать в интерфейсе оплаты. */
paymentsRouter.get('/config', (_req, res) => {
  res.json({
    online: true,
    mock: yoo.isMockMode(),
    test: yoo.isTestShop(),
    provider: 'ЮKassa',
  });
});

/** POST /api/payments/create — получить ссылку на оплату заказа. */
paymentsRouter.post('/create', async (req, res) => {
  try {
    const orderId = Number((req.body || {}).orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      res.status(400).json({ error: 'Некорректный orderId' });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    if (!ownsOrder(req, order.telegramUserId)) {
      res.status(403).json({ error: 'Это не ваш заказ' });
      return;
    }

    const result = await startPaymentForOrder(orderId);
    res.json(result);
  } catch (error: any) {
    console.error('[payments] создание платежа:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Не удалось создать платёж' });
  }
});

/**
 * GET /api/payments/status/:orderId — статус оплаты.
 * Приложение опрашивает этот эндпоинт, пока пользователь платит: если вебхук
 * не дошёл (нет публичного адреса, упала сеть), статус всё равно подтянется.
 */
paymentsRouter.get('/status/:orderId', async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    if (!ownsOrder(req, order.telegramUserId)) {
      res.status(403).json({ error: 'Это не ваш заказ' });
      return;
    }

    // Ждём деньги — спросим у платёжки напрямую.
    if (order.paymentId && order.paymentStatus === 'PENDING') {
      await syncPaymentStatus(order.paymentId);
    }

    const fresh = await prisma.order.findUnique({ where: { id: orderId } });
    res.json({
      orderId,
      status: fresh!.status,
      paymentType: fresh!.paymentType,
      paymentStatus: fresh!.paymentStatus,
      paymentMethod: fresh!.paymentMethod,
      paidAt: fresh!.paidAt,
      totalPrice: fresh!.totalPrice / 100,
      itemsCount: (JSON.parse(fresh!.items) as Array<{ qty: number }>).reduce((acc, i) => acc + i.qty, 0),
    });
  } catch (error: any) {
    console.error('[payments] статус платежа:', error);
    res.status(500).json({ error: 'Не удалось получить статус' });
  }
});
