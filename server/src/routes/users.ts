import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isAdmin } from '../middleware/isAdmin.js';
import { bot } from '../lib/bot.js';

const router = Router();

// POST /api/users/auth — авторизация / upsert пользователя
router.post('/auth', async (req, res) => {
  try {
    const tgUser = req.telegramUser;

    if (!tgUser || !tgUser.id) {
      res.status(400).json({ error: 'Telegram user data required' });
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

    // Проверяем, является ли пользователь админом
    const adminIds = (process.env.ADMIN_IDS || '').replace(/["']/g, '').split(',').map((id) => id.trim());
    const userIsAdmin = adminIds.includes(tgUser.id.toString());

    res.json({
      id: user.id,
      telegramId: Number(user.telegramId),
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      isAdmin: userIsAdmin,
    });
  } catch (error) {
    console.error('Error authenticating user:', error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
});

// GET /api/users/stats — статистика пользователей (admin)
router.get('/stats', isAdmin, async (_req, res) => {
  try {
    const totalUsers = await prisma.user.count();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeUsersWeek = await prisma.user.count({
      where: { lastVisit: { gte: weekAgo } },
    });

    const totalOrders = await prisma.order.count();
    const newOrders = await prisma.order.count({
      where: { status: 'NEW' },
    });

    res.json({
      totalUsers,
      activeUsersWeek,
      totalOrders,
      newOrders,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/users/broadcast — рассылка сообщений пользователям (admin)
router.post('/broadcast', isAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const users = await prisma.user.findMany({
      select: { telegramId: true },
    });

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegramId.toString(), message, { parse_mode: 'Markdown' });
        successCount++;
      } catch (err) {
        failCount++;
      }
      // Задержка 50мс для предотвращения блокировки (ограничение TG - 30 сообщений в секунду)
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    res.json({
      total: users.length,
      successCount,
      failCount,
    });
  } catch (error) {
    console.error('Error broadcasting message:', error);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

export default router;
