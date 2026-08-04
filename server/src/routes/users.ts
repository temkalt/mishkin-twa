import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isAdmin } from '../middleware/isAdmin.js';

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
    const adminIds = (process.env.ADMIN_IDS || '').split(',').map((id) => id.trim());
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

export default router;
