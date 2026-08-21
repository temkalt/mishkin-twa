import type { Request, Response, NextFunction } from 'express';
import { isAdminId } from '../lib/admins.js';

/**
 * Доступ только администраторам из ADMIN_IDS.
 *
 * Права намеренно не берутся из БД (`User.isAdmin`) и тем более из запроса:
 * единственный источник — переменная окружения, см. lib/admins.ts.
 */
export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminId(req.telegramUser?.id)) {
    res.status(403).json({ error: 'Access denied: Admins only' });
    return;
  }

  next();
}
