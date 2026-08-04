import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { validateTelegram } from './middleware/validateTelegram.js';
import { launchBot } from './lib/bot.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import promoRouter from './routes/promo.js';
import usersRouter from './routes/users.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// --- Middleware ---
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', process.env.WEBAPP_URL || ''].filter(Boolean),
  credentials: true,
}));
app.use(express.json());

// Telegram initData validation for all /api routes
app.use('/api', validateTelegram);

// --- Routes ---
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/promo', promoRouter);
app.use('/api/users', usersRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`\n🚀 MISHKIN API server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Products API: http://localhost:${PORT}/api/products\n`);
});

// Launch Telegram bot
launchBot();
