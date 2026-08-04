import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware для проверки, является ли пользователь администратором.
 * Сравнивает telegramUser.id с ADMIN_IDS из .env.
 */
export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminIdsRaw = process.env.ADMIN_IDS || '';
  const adminIds = adminIdsRaw.split(',').map((id) => parseInt(id.trim(), 10));

  const userId = req.telegramUser?.id;

  if (!userId || !adminIds.includes(userId)) {
    // В dev-режиме разрешаем для удобства
    if (process.env.NODE_ENV === 'development') {
      next();
      return;
    }
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
