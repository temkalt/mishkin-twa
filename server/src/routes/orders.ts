import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isAdmin } from '../middleware/isAdmin.js';
import { bot } from '../lib/bot.js';

const router = Router();

// POST /api/orders — создать заказ
router.post('/', async (req, res) => {
  try {
    const { items, userName, userPhone, userCity, userAddress, userPostal, deliveryMethod, comment, promoCode } = req.body;
    const telegramUserId = req.telegramUser?.id || 0;
    const tgUsername = req.telegramUser?.username || null;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }
    if (!userName || typeof userName !== 'string' || !userName.trim()) {
      res.status(400).json({ error: 'User name is required' });
      return;
    }
    if (!userPhone || typeof userPhone !== 'string' || !userPhone.trim()) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }
    if (!deliveryMethod || typeof deliveryMethod !== 'string') {
      res.status(400).json({ error: 'Delivery method is required' });
      return;
    }

    // Подсчитываем итоговую сумму, подтягивая цены из БД
    let totalPrice = 0;
    const orderItems: Array<{ productId: number; name: string; price: number; qty: number; image?: string }> = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        res.status(400).json({ error: `Product #${item.productId} not found` });
        return;
      }
      
      let img = '';
      try {
        const imgs = JSON.parse(product.images);
        img = imgs[0] || '';
      } catch { /* ignore */ }

      const lineTotal = product.price * item.qty;
      totalPrice += lineTotal;
      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: item.qty,
        image: img,
      });
    }

    // Обработка промокода
    let discount = 0;
    let appliedPromoCode: string | null = null;

    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: promoCode.toUpperCase() },
      });

      if (promo && promo.isActive) {
        if (promo.usageLimit === 0 || promo.usageCount < promo.usageLimit) {
          if (promo.discountType === 'PERCENT') {
            discount = Math.round(totalPrice * (promo.discountValue / 100));
          } else {
            discount = promo.discountValue;
          }
          // Скидка не может превышать общую сумму
          discount = Math.min(discount, totalPrice);
          appliedPromoCode = promo.code;

          // Увеличить счётчик использований
          await prisma.promoCode.update({
            where: { id: promo.id },
            data: { usageCount: promo.usageCount + 1 },
          });
        }
      }
    }

    const finalPrice = Math.max(0, totalPrice - discount);

    // Создаём заказ
    const order = await prisma.order.create({
      data: {
        telegramUserId: BigInt(telegramUserId),
        userName: userName || 'Гость',
        userPhone: userPhone || '',
        userCity: userCity || '',
        userAddress: userAddress || '',
        userPostal: userPostal || '',
        deliveryMethod: deliveryMethod || 'CDEK',
        comment: comment || '',
        tgUsername: tgUsername,
        items: JSON.stringify(orderItems),
        totalPrice: finalPrice,
        promoCode: appliedPromoCode,
        discount,
        status: 'NEW',
      },
    });

    // Отправляем уведомление менеджеру в Telegram
    try {
      const adminIds = (process.env.ADMIN_IDS || '').replace(/["']/g, '').split(',').map((id) => parseInt(id.trim(), 10));

      const itemsText = orderItems
        .map((item) => `  • ${item.name} × ${item.qty} = ${(item.price * item.qty / 100).toLocaleString('ru-RU')} ₽`)
        .join('\n');

      const tgUserId = req.telegramUser?.id || '';
      const tgUserLink = tgUsername ? `[@${tgUsername}](https://t.me/${tgUsername})` : `[Профиль](tg://user?id=${tgUserId})`;

      const message =
        `🔔 *Новый заказ #${order.id}*\n\n` +
        `👤 Клиент: ${userName || 'Гость'} (TG: ${tgUserLink})\n` +
        `📱 Телефон: ${userPhone || 'не указан'}\n` +
        `🚚 Способ доставки: ${deliveryMethod || 'не указан'}\n` +
        `🏙 Город: ${userCity || 'не указан'}\n` +
        `📍 Адрес: ${userAddress || 'не указан'}\n` +
        `📮 Индекс: ${userPostal || 'не указан'}\n` +
        (comment ? `💬 Комментарий: ${comment}\n\n` : '\n') +
        `📦 Товары:\n${itemsText}\n\n` +
        (discount > 0 ? `🏷 Промокод: ${appliedPromoCode} (-${(discount / 100).toLocaleString('ru-RU')} ₽)\n` : '') +
        `💰 *Итого: ${(finalPrice / 100).toLocaleString('ru-RU')} ₽*`;

      for (const adminId of adminIds) {
        if (adminId) {
          await bot.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } });
        }
      }
    } catch (notifyError) {
      console.error('Failed to notify admin:', notifyError);
      // Не прерываем — заказ уже создан
    }

    res.status(201).json({
      id: Number(order.id),
      totalPrice: finalPrice / 100,
      discount: discount / 100,
      status: order.status,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/orders — заказы пользователя (или все для админа)
router.get('/', async (req, res) => {
  try {
    const telegramUserId = req.telegramUser?.id || 0;
    const adminIdsRaw = process.env.ADMIN_IDS || '';
    const adminIds = adminIdsRaw.replace(/["']/g, '').split(',').map((id) => id.trim());
    
    const isUserAdmin = adminIds.includes(telegramUserId.toString());

    const orders = await prisma.order.findMany({
      where: isUserAdmin ? undefined : { telegramUserId: BigInt(telegramUserId) },
      orderBy: { createdAt: 'desc' },
    });

    // Получаем все продукты для быстрого поиска картинок
    const allProducts = await prisma.product.findMany({ select: { id: true, images: true } });
    const productImagesMap = new Map<number, string>();
    for (const p of allProducts) {
      try {
        const imgs = JSON.parse(p.images);
        productImagesMap.set(p.id, imgs[0] || '');
      } catch {
        productImagesMap.set(p.id, '');
      }
    }

    const parsed = orders.map((o) => {
      const parsedItems = JSON.parse(o.items).map((item: any) => {
        if (!item.image && productImagesMap.has(item.productId)) {
          item.image = productImagesMap.get(item.productId);
        }
        return item;
      });

      return {
        ...o,
        telegramUserId: Number(o.telegramUserId),
        items: parsedItems,
        totalPrice: o.totalPrice / 100,
        discount: o.discount / 100,
      };
    });

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PATCH /api/orders/:id/status — обновить статус (admin/demo)
router.patch('/:id/status', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { status } = req.body;

    const validStatuses = ['NEW', 'CONFIRMED', 'SHIPPED', 'DONE', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    res.json({ id: order.id, status: order.status });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
