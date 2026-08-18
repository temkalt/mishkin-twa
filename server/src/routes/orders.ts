import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { isAdmin } from '../middleware/isAdmin.js';
import { bot } from '../lib/bot.js';
import { notifyOrderStatus } from '../lib/paymentService.js';
import { isAvailable, releaseStockForOrder, reserveStock, type StockError } from '../lib/stock.js';
import {
  DELIVERY_OPTIONS,
  FREE_DELIVERY_FROM,
  findDeliveryOption,
  deliveryPriceFor,
} from '../lib/delivery.js';

const router = Router();

const ORDER_STATUSES = ['NEW', 'CONFIRMED', 'SHIPPED', 'DONE', 'CANCELLED'] as const;

const createOrderSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          qty: z.number().int().min(1).max(99),
        }),
      )
      .min(1, 'Корзина пуста')
      .max(50),
    userName: z.string().trim().min(2, 'Укажите имя').max(80),
    userPhone: z
      .string()
      .trim()
      .refine((value) => value.replace(/\D/g, '').length >= 10, 'Некорректный телефон'),
    userCity: z.string().trim().max(120).default(''),
    userAddress: z.string().trim().max(300).default(''),
    userPostal: z.string().trim().max(12).default(''),
    deliveryMethod: z.string().trim().min(1, 'Выберите способ доставки').max(40),
    comment: z.string().trim().max(1000).default(''),
    promoCode: z.string().trim().max(40).nullish(),
    paymentType: z.enum(['ONLINE', 'MANUAL']).default('ONLINE'),
    consent: z.literal(true, { message: 'Нужно согласие на обработку персональных данных' }),
  })
  .superRefine((data, ctx) => {
    const option = findDeliveryOption(data.deliveryMethod);
    if (!option) {
      ctx.addIssue({ code: 'custom', path: ['deliveryMethod'], message: 'Неизвестный способ доставки' });
      return;
    }
    // Адрес обязателен только там, где он нужен — самовывоз без адреса.
    if (option.requiresAddress) {
      if (!data.userCity) {
        ctx.addIssue({ code: 'custom', path: ['userCity'], message: 'Укажите город' });
      }
      if (!data.userAddress) {
        ctx.addIssue({ code: 'custom', path: ['userAddress'], message: 'Укажите адрес или пункт выдачи' });
      }
    }
  });

const rub = (kopecks: number) => (kopecks / 100).toLocaleString('ru-RU');

/** GET /api/orders/delivery-options — способы доставки и их цены. */
router.get('/delivery-options', (_req, res) => {
  res.json({
    freeFrom: FREE_DELIVERY_FROM / 100,
    options: DELIVERY_OPTIONS.map((option) => ({ ...option, price: option.price / 100 })),
  });
});

// POST /api/orders — создать заказ
router.post('/', async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Некорректные данные заказа',
      issues: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
    return;
  }

  const input = parsed.data;
  const telegramUserId = req.telegramUser?.id ?? 0;
  const tgUsername = req.telegramUser?.username || null;

  try {
    // Цены берём из БД, а не из запроса — клиент не может назначить свою цену.
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const byId = new Map(products.map((product) => [product.id, product]));

    const missing = productIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      res.status(400).json({ error: `Товар #${missing[0]} больше не доступен` });
      return;
    }
    const unavailable = products.find((product) => !isAvailable(product));
    if (unavailable) {
      res.status(409).json({ error: `«${unavailable.name}» закончился — уберите его из корзины` });
      return;
    }

    // Сколько штук каждого товара просят: одна позиция может прийти дважды.
    const qtyByProduct = new Map<number, number>();
    for (const item of input.items) {
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
    }

    // Заранее понятную нехватку отсекаем до транзакции — покупателю нужен не
    // «не удалось создать заказ», а «осталось 2 шт.».
    const short = products.find(
      (product) => product.stock !== null && product.stock < (qtyByProduct.get(product.id) ?? 0),
    );
    if (short) {
      res.status(409).json({
        error: short.stock === 0
          ? `«${short.name}» закончился — уберите его из корзины`
          : `«${short.name}»: осталось ${short.stock} шт. — уменьшите количество`,
      });
      return;
    }

    let itemsTotal = 0;
    const orderItems = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      let image = '';
      try {
        image = (JSON.parse(product.images) as string[])[0] || '';
      } catch {
        /* картинка не обязательна */
      }
      itemsTotal += product.price * item.qty;
      return { productId: product.id, name: product.name, price: product.price, qty: item.qty, image };
    });

    const deliveryPrice = deliveryPriceFor(input.deliveryMethod, itemsTotal);
    const deliveryOption = findDeliveryOption(input.deliveryMethod)!;

    // Промокод, остаток и заказ — в одной транзакции: счётчик использований не
    // уедет при одновременных заказах, заказ не создастся со «сгоревшей»
    // скидкой, а склад не уйдёт в минус, если последнюю свечу оформляют вдвоём.
    const { order, discount, appliedPromo } = await prisma.$transaction(async (tx) => {
      const shortage = await reserveStock(
        tx,
        [...qtyByProduct].map(([productId, qty]) => {
          const product = byId.get(productId)!;
          return { productId, name: product.name, qty, stock: product.stock };
        }),
      );
      // Откатываем всю транзакцию: списанные ранее позиции вернутся сами.
      if (shortage) throw Object.assign(new Error('OUT_OF_STOCK'), { shortage });

      let discountValue = 0;
      let appliedCode: string | null = null;

      if (input.promoCode) {
        const promo = await tx.promoCode.findUnique({ where: { code: input.promoCode.toUpperCase() } });
        const usable = promo && promo.isActive && (promo.usageLimit === 0 || promo.usageCount < promo.usageLimit);

        if (usable) {
          discountValue =
            promo.discountType === 'PERCENT'
              ? Math.round(itemsTotal * (promo.discountValue / 100))
              : promo.discountValue;
          discountValue = Math.min(discountValue, itemsTotal);
          appliedCode = promo.code;

          await tx.promoCode.update({
            where: { id: promo.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      const totalPrice = Math.max(0, itemsTotal - discountValue) + deliveryPrice;

      const created = await tx.order.create({
        data: {
          telegramUserId: BigInt(telegramUserId),
          userName: input.userName,
          userPhone: input.userPhone,
          userCity: input.userCity,
          userAddress: deliveryOption.requiresAddress ? input.userAddress : '',
          userPostal: deliveryOption.requiresAddress ? input.userPostal : '',
          deliveryMethod: deliveryOption.id,
          deliveryPrice,
          comment: input.comment,
          tgUsername,
          items: JSON.stringify(orderItems),
          itemsTotal,
          totalPrice,
          promoCode: appliedCode,
          discount: discountValue,
          status: 'NEW',
          paymentType: input.paymentType,
          paymentStatus: 'UNPAID',
          consentAt: new Date(),
        },
      });

      return { order: created, discount: discountValue, appliedPromo: appliedCode };
    });

    void notifyNewOrder({ order, orderItems, deliveryLabel: deliveryOption.label, discount, appliedPromo });

    res.status(201).json({
      id: order.id,
      itemsTotal: itemsTotal / 100,
      deliveryPrice: deliveryPrice / 100,
      totalPrice: order.totalPrice / 100,
      discount: discount / 100,
      status: order.status,
      paymentType: order.paymentType,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    // Остаток разобрали, пока покупатель заполнял форму.
    const shortage = (error as { shortage?: StockError })?.shortage;
    if (shortage) {
      res.status(409).json({
        error: shortage.available > 0
          ? `«${shortage.name}»: осталось ${shortage.available} шт. — уменьшите количество`
          : `«${shortage.name}» только что закончился — уберите его из корзины`,
      });
      return;
    }
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Не удалось создать заказ' });
  }
});

/** Сообщение менеджеру о новом заказе. Падение уведомления не ломает заказ. */
async function notifyNewOrder(params: {
  order: { id: number; userName: string; userPhone: string; userCity: string; userAddress: string; userPostal: string; comment: string; totalPrice: number; paymentType: string; tgUsername: string | null; telegramUserId: bigint };
  orderItems: Array<{ name: string; price: number; qty: number }>;
  deliveryLabel: string;
  discount: number;
  appliedPromo: string | null;
}): Promise<void> {
  const { order, orderItems, deliveryLabel, discount, appliedPromo } = params;

  const adminIds = (process.env.ADMIN_IDS || '')
    .replace(/["']/g, '')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (adminIds.length === 0) return;

  const itemsText = orderItems
    .map((item) => `  • ${item.name} × ${item.qty} = ${rub(item.price * item.qty)} ₽`)
    .join('\n');

  const tgLink = order.tgUsername
    ? `[@${order.tgUsername}](https://t.me/${order.tgUsername})`
    : `[Профиль](tg://user?id=${order.telegramUserId.toString()})`;

  const message =
    `🔔 *Новый заказ #${order.id}*\n\n` +
    `👤 Клиент: ${order.userName} (TG: ${tgLink})\n` +
    `📱 Телефон: ${order.userPhone}\n` +
    `🚚 Доставка: ${deliveryLabel}\n` +
    (order.userCity ? `🏙 Город: ${order.userCity}\n` : '') +
    (order.userAddress ? `📍 Адрес: ${order.userAddress}\n` : '') +
    (order.userPostal ? `📮 Индекс: ${order.userPostal}\n` : '') +
    (order.comment ? `💬 Комментарий: ${order.comment}\n` : '') +
    `\n📦 Товары:\n${itemsText}\n\n` +
    (discount > 0 ? `🏷 Промокод: ${appliedPromo} (−${rub(discount)} ₽)\n` : '') +
    `💰 *Итого: ${rub(order.totalPrice)} ₽*\n` +
    `${order.paymentType === 'ONLINE' ? '💳 Ожидает онлайн-оплату' : '🤝 Оплата при получении / по договорённости'}`;

  for (const adminId of adminIds) {
    try {
      await bot.telegram.sendMessage(adminId, message, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      console.error('Failed to notify admin:', adminId, error);
    }
  }
}

// GET /api/orders — заказы пользователя (или все для админа)
router.get('/', async (req, res) => {
  try {
    const telegramUserId = req.telegramUser?.id ?? 0;
    const adminIds = (process.env.ADMIN_IDS || '').replace(/["']/g, '').split(',').map((id) => id.trim());
    const isUserAdmin = adminIds.includes(telegramUserId.toString());

    const take = Math.min(Number(req.query.limit) || 50, 100);
    const skip = Math.max(Number(req.query.offset) || 0, 0);

    const orders = await prisma.order.findMany({
      where: isUserAdmin ? undefined : { telegramUserId: BigInt(telegramUserId) },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    // Картинки товаров могли появиться уже после заказа — подставим свежие.
    const allProducts = await prisma.product.findMany({ select: { id: true, images: true } });
    const imageById = new Map<number, string>();
    for (const product of allProducts) {
      try {
        imageById.set(product.id, (JSON.parse(product.images) as string[])[0] || '');
      } catch {
        imageById.set(product.id, '');
      }
    }

    const parsed = orders.map((order) => ({
      ...order,
      telegramUserId: Number(order.telegramUserId),
      items: (JSON.parse(order.items) as Array<{ productId: number; image?: string }>).map((item) => ({
        ...item,
        image: item.image || imageById.get(item.productId) || '',
      })),
      itemsTotal: order.itemsTotal / 100,
      deliveryPrice: order.deliveryPrice / 100,
      totalPrice: order.totalPrice / 100,
      discount: order.discount / 100,
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  trackNumber: z.string().trim().max(60).optional(),
});

// PATCH /api/orders/:id/status — сменить статус (только админ)
router.patch('/:id/status', isAdmin, async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некорректный статус' });
    return;
  }

  try {
    const id = parseInt(String(req.params.id), 10);
    const order = await prisma.order.update({
      where: { id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.trackNumber !== undefined ? { trackNumber: parsed.data.trackNumber } : {}),
      },
    });

    // Клиент узнаёт о смене статуса сам, без звонка менеджера.
    void notifyOrderStatus(order.telegramUserId, order.id, order.status);

    // Отменённый заказ отпускает товар обратно на склад. Обратный переход
    // («Отменён» → любой другой) остаток не резервирует заново — админка такой
    // кнопки не показывает, а тихо занимать склад из-под покупателей нельзя.
    if (order.status === 'CANCELLED') {
      const returned = await releaseStockForOrder(order.id);
      if (returned) console.log(`[stock] заказ #${order.id} отменён — остаток возвращён на склад`);
    }

    res.json({ id: order.id, status: order.status, trackNumber: order.trackNumber });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
