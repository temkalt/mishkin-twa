import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { validateTelegram } from './middleware/validateTelegram.js';
import { launchBot, bot } from './lib/bot.js';
import { prisma } from './lib/prisma.js';
import * as yoo from './lib/yookassa.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import promoRouter from './routes/promo.js';
import usersRouter from './routes/users.js';
import channelRouter from './routes/channel.js';
import { paymentsRouter, paymentsPublicRouter } from './routes/payments.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// За прокси (Vercel, Caddy, туннель) — иначе req.ip вернёт адрес прокси,
// а не отправителя, и проверка IP уведомлений сломается.
app.set('trust proxy', 1);

// --- Безопасность и транспорт ---
app.use(helmet({
  // Страницу эмулятора отдаём мы же, а фронт живёт на другом origin —
  // CSP настраивается на раздаче статики, здесь она только мешает.
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://mishkin-twa.vercel.app',
  process.env.WEBAPP_URL || '',
  process.env.PUBLIC_URL || '',
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));

// Большое тело нужно ровно одной точке — созданию товара: фотографии приходят
// base64-строками в JSON. Остальным 15 МБ не нужны и опасны: публичный вебхук
// оплаты парсится ДО проверки IP, то есть кто угодно мог прислать туда 15 МБ.
app.use('/api/products', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '256kb' }));

// --- Bot webhook (до validateTelegram: Telegram не присылает initData) ---
// secretToken заставляет Telegraf проверять заголовок
// X-Telegram-Bot-Api-Secret-Token: без этого адрес вебхука — открытая точка,
// куда любой может слать поддельные апдейты бота.
app.use(bot.webhookCallback('/api/webhook', { secretToken: process.env.WEBHOOK_SECRET }));

/**
 * Установка webhook бота. Раньше эндпоинт был открыт — любой мог перевесить
 * бота на свой адрес. Теперь нужен секрет из env.
 */
app.get('/api/setup-webhook', async (req, res) => {
  const secret = process.env.SETUP_SECRET;
  if (!secret || req.query.secret !== secret) {
    res.status(403).send('Forbidden');
    return;
  }
  try {
    const url = `https://${req.headers.host}/api/webhook`;
    await bot.telegram.setWebhook(url, { secret_token: process.env.WEBHOOK_SECRET || undefined });
    res.send(`Webhook successfully set to: ${url}`);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

// --- Уведомления ЮKassa и страница эмулятора: без Telegram initData ---
const webhookLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api/payments', webhookLimiter, paymentsPublicRouter);

// --- Telegram initData для остальных REST-роутов ---
app.use('/api', validateTelegram);

// Точки, где имеет смысл ограничить частоту: создание заказов, промокоды, авторизация.
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

// --- Роуты ---
app.use('/api/products', productsRouter);
app.use('/api/orders', writeLimiter, ordersRouter);
app.use('/api/promo', writeLimiter, promoRouter);
app.use('/api/users', writeLimiter, usersRouter);
app.use('/api/channel', channelRouter);
app.use('/api/payments', paymentsRouter);

// Health check с проверкой БД — иначе «ok» при мёртвой базе.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      db: 'up',
      payments: yoo.describeMode(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down', timestamp: new Date().toISOString() });
  }
});

// --- Обработчик ошибок ---
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error]', err);
  const status = err.status || 500;
  // В проде наружу не отдаём внутренние сообщения — только код и общий текст.
  res.status(status).json({
    error: isProd && status >= 500 ? 'Internal Server Error' : err.message || 'Internal Server Error',
  });
});

// Локальный запуск. На Vercel слушать порт не нужно — там экспортируется
// приложение, а бота дёргает вебхук, поэтому launchBot() здесь и только здесь.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const mode = yoo.describeMode();
    console.log(`\n🚀 MISHKIN API на http://localhost:${PORT}`);
    console.log(`   Оплата: ЮKassa, режим ${mode.mode}${mode.test ? ' (тестовый контур)' : ''}`);
    if (mode.mode === 'mock') {
      console.log('   ⚠️  Реквизитов ЮKassa нет — работает встроенный эмулятор оплаты.');
    }
    console.log('');
  });
  launchBot();
}

// Vercel забирает приложение как serverless-функцию.
export default app;
