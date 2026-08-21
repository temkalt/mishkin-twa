import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

declare global {
  namespace Express {
    interface Request {
      telegramUser?: TelegramUser;
    }
  }
}

/** Сколько живёт подпись initData. Столько же держит окно и сам Telegram. */
const INIT_DATA_TTL_SECONDS = 86400;

/**
 * Разрешён ли доступ без Telegram initData.
 *
 * Нужно в двух случаях: локальная разработка и демонстрация магазина в обычном
 * браузере (заказчику, без Telegram). В остальных случаях запрос без подписи
 * отклоняется — иначе `POST /api/orders` дёргается откуда угодно и в базу
 * летит спам.
 *
 * Внимание: все анонимные посетители получают один и тот же id = 0, то есть
 * общий «кабинет». В боевом окружении флаг должен быть выключен, иначе один
 * гость видит заказы другого (имя, телефон, адрес) через GET /api/orders.
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
 * Валидация initData по схеме Telegram: HMAC-SHA256, где ключ сам получен как
 * HMAC от строки «WebAppData» на токене бота.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Личность пользователя берётся ТОЛЬКО из подписанной строки: поле `user`
 * читается уже после сверки хэша, поэтому подменить свой id в теле запроса
 * нельзя — оно вообще не участвует в авторизации.
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

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      res.status(401).json({ error: 'Missing hash in init data' });
      return;
    }

    // Подписывается всё, кроме самого hash, отсортированное по имени ключа.
    urlParams.delete('hash');
    urlParams.sort();
    const dataCheckArr: string[] = [];
    urlParams.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hmac = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (!hashesEqual(hmac, hash)) {
      res.status(401).json({ error: 'Invalid init data signature' });
      return;
    }

    // auth_date обязателен: подпись сама по себе бессрочна, и без отметки
    // времени перехваченный initData работал бы вечно. Отсутствие поля — повод
    // отказать, а не пропустить проверку.
    const authDate = urlParams.get('auth_date');
    const authTimestamp = authDate ? parseInt(authDate, 10) : NaN;
    if (!Number.isFinite(authTimestamp)) {
      res.status(401).json({ error: 'Init data has no auth_date' });
      return;
    }
    if (Math.floor(Date.now() / 1000) - authTimestamp > INIT_DATA_TTL_SECONDS) {
      res.status(401).json({ error: 'Init data expired' });
      return;
    }

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
