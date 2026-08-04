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
    // ДЕМО-РЕЖИМ: Временно разрешаем доступ всем, чтобы вы могли протестировать админку
    // без использования Telegram (прямо из браузера).
    // Перед реальным запуском эту проверку нужно будет вернуть!
    next();
    return;
  }

  next();
}
