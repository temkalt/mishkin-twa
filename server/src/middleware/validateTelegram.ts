import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramUser;
    }
  }
}

/**
 * Разрешён ли доступ без Telegram initData.
 *
 * Нужно в двух случаях: локальная разработка и демонстрация магазина в обычном
 * браузере (заказчику, без Telegram). В остальных случаях запрос без подписи
 * отклоняется — иначе `POST /api/orders` дёргается откуда угодно и в базу
 * летит спам.
 */
function guestAccessAllowed(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.ALLOW_BROWSER_DEMO === 'true';
}

const GUEST: TelegramUser = { id: 0, first_name: 'Гость', username: 'guest' };

/** Сравнение хэшей без утечки по времени. */
function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Middleware для криптографической валидации initData от Telegram.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegram(req: Request, res: Response, next: NextFunction): void {
  const initData = req.headers['x-telegram-init-data'] as string | undefined;

  if (!initData) {
    if (guestAccessAllowed()) {
      req.telegramUser = GUEST;
      next();
      return;
    }
    res.status(401).json({ error: 'Требуется Telegram initData' });
    return;
  }

  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
      console.error('[auth] BOT_TOKEN не задан — валидация initData невозможна');
      res.status(500).json({ error: 'Server misconfigured' });
      return;
    }

    // 1. Parse initData into key-value pairs
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      res.status(401).json({ error: 'Missing hash in init data' });
      return;
    }

    // 2. Remove hash and sort remaining params alphabetically
    urlParams.delete('hash');
    const dataCheckArr: string[] = [];
    urlParams.sort();
    urlParams.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    const dataCheckString = dataCheckArr.join('\n');

    // 3. Create HMAC-SHA256 signature
    const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hmac = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // 4. Compare hashes
    if (!hashesEqual(hmac, hash)) {
      res.status(401).json({ error: 'Invalid init data signature' });
      return;
    }

    // 5. Check auth_date (not older than 24 hours)
    const authDate = urlParams.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10);
      const now = Math.floor(Date.now() / 1000);
      if (now - authTimestamp > 86400) {
        res.status(401).json({ error: 'Init data expired' });
        return;
      }
    }

    // 6. Extract user data
    const userParam = urlParams.get('user');
    if (!userParam) {
      res.status(401).json({ error: 'Init data has no user' });
      return;
    }
    req.telegramUser = JSON.parse(userParam) as TelegramUser;

    next();
  } catch (error) {
    console.error('Telegram validation error:', error);
    res.status(401).json({ error: 'Init data validation failed' });
  }
}
