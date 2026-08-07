import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { validateTelegram } from './middleware/validateTelegram.js';
import { launchBot, bot } from './lib/bot.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import promoRouter from './routes/promo.js';
import usersRouter from './routes/users.js';
import channelRouter from './routes/channel.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// --- Middleware ---
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://mishkin-twa.vercel.app',
    process.env.WEBAPP_URL || '',
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());

// Vercel webhook endpoint
app.use(bot.webhookCallback('/api/webhook'));

// Setup webhook route (visit once after deployment)
app.get('/api/setup-webhook', async (req, res) => {
  try {
    const url = `https://${req.headers.host}/api/webhook`;
    await bot.telegram.setWebhook(url);
    res.send(`Webhook successfully set to: ${url}`);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

// Telegram initData validation for all REST API routes
app.use('/api', validateTelegram);

// --- Routes ---
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/promo', promoRouter);
app.use('/api/users', usersRouter);
app.use('/api/channel', channelRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint — shows what the server sees about the current user
app.get('/api/debug-auth', (req, res) => {
  const adminIdsRaw = process.env.ADMIN_IDS || '';
  const adminIds = adminIdsRaw.replace(/["']/g, '').split(',').map((id) => id.trim());
  const telegramUser = req.telegramUser;
  const userId = telegramUser?.id?.toString() || 'NOT SET';
  res.json({
    telegramUser: telegramUser || null,
    userId,
    adminIdsRaw,
    adminIds,
    isAdmin: adminIds.includes(userId),
  });
});



// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// --- Start Local Server ---
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 MISHKIN API server running locally on http://localhost:${PORT}`);
    console.log(`   Products API: http://localhost:${PORT}/api/products\n`);
  });
  launchBot();
}

// Export for Vercel Serverless
export default app;
