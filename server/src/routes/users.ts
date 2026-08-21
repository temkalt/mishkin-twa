import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { isAdmin } from '../middleware/isAdmin.js';
import { bot } from '../lib/bot.js';
import { isAdminId } from '../lib/admins.js';

const router = Router();

// POST /api/users/auth — авторизация / upsert пользователя
router.post('/auth', async (req, res) => {
  try {
    const tgUser = req.telegramUser;

    if (!tgUser || !tgUser.id) {
      res.status(400).json({ error: 'Telegram user data required' });
      return;
    }

    // Флаг только для интерфейса: сервер всё равно перепроверяет права на каждом
    // админском роуте через middleware/isAdmin.ts.
    const userIsAdmin = isAdminId(tgUser.id);

    // Гостя из браузерного демо в базу не пишем — иначе статистика засоряется.
    if (tgUser.id === 0) {
      res.json({
        id: 0,
        telegramId: 0,
        firstName: tgUser.first_name,
        lastName: null,
        username: tgUser.username || null,
        isAdmin: false,
        guest: true,
      });
      return;
    }

    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
        lastVisit: new Date(),
      },
      create: {
        telegramId: BigInt(tgUser.id),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
      },
    });

    res.json({
      id: user.id,
      telegramId: Number(user.telegramId),
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      isAdmin: userIsAdmin,
      guest: false,
    });
  } catch (error) {
    console.error('Error authenticating user:', error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
});

// GET /api/users/stats — статистика (admin)
router.get('/stats', isAdmin, async (_req, res) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [totalUsers, activeUsersWeek, totalOrders, newOrders, paidAgg, weekPaidAgg] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastVisit: { gte: weekAgo } } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'NEW' } }),
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { totalPrice: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID', paidAt: { gte: weekAgo } },
        _sum: { totalPrice: true },
      }),
    ]);

    const revenue = (paidAgg._sum.totalPrice || 0) / 100;
    const paidOrders = paidAgg._count;

    res.json({
      totalUsers,
      activeUsersWeek,
      totalOrders,
      newOrders,
      paidOrders,
      revenue,
      revenueWeek: (weekPaidAgg._sum.totalPrice || 0) / 100,
      averageOrder: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0,
      conversion: totalUsers > 0 ? Math.round((paidOrders / totalUsers) * 1000) / 10 : 0,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

const broadcastSchema = z.object({
  message: z.string().trim().min(1, 'Введите текст').max(4000),
});

/** Telegram допускает ~30 сообщений в секунду — шлём пачками, а не по одному. */
const BATCH_SIZE = 25;
const BATCH_PAUSE_MS = 1100;

// POST /api/users/broadcast — рассылка (admin)
router.post('/broadcast', isAdmin, async (req, res) => {
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Введите текст' });
    return;
  }

  try {
    const users = await prisma.user.findMany({ select: { telegramId: true } });
    let successCount = 0;
    let blockedCount = 0;
    let failCount = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((user) =>
          bot.telegram.sendMessage(user.telegramId.toString(), parsed.data.message, { parse_mode: 'Markdown' }),
        ),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          // 403 = пользователь заблокировал бота: это не сбой рассылки.
          const code = (result.reason as { response?: { error_code?: number } })?.response?.error_code;
          if (code === 403) blockedCount++;
          else failCount++;
        }
      }

      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
      }
    }

    res.json({ total: users.length, successCount, blockedCount, failCount });
  } catch (error) {
    console.error('Error broadcasting message:', error);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

export default router;
