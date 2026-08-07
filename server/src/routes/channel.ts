import { Router } from 'express';
import { isAdmin } from '../middleware/isAdmin.js';
import { checkBotIsAdmin, publishPost, buildMiniAppUrl } from '../lib/channelPost.js';

const router = Router();

// POST /api/channel/post — создать пост в канале (admin)
router.post('/post', isAdmin, async (req, res) => {
  try {
    const { text, photoUrl, buttonText, startParam } = req.body;

    if (!text && !photoUrl) {
      res.status(400).json({ error: 'Текст или фото обязательны' });
      return;
    }

    const channelId = process.env.CHANNEL_ID;
    if (!channelId) {
      res.status(500).json({ error: 'CHANNEL_ID не настроен в .env' });
      return;
    }

    const isAdminInChannel = await checkBotIsAdmin(channelId);
    if (!isAdminInChannel) {
      res.status(403).json({ error: `Бот не является администратором в канале ${channelId}. Добавьте бота в канал и дайте ему права на публикацию сообщений.` });
      return;
    }

    const message = await publishPost(channelId, text, photoUrl, buttonText, startParam);

    res.json({
      success: true,
      messageId: message.message_id,
      channelId: channelId,
      url: buildMiniAppUrl(startParam)
    });
  } catch (error: any) {
    console.error('Error publishing to channel:', error);
    res.status(500).json({ error: error.message || 'Failed to publish post' });
  }
});

// GET /api/channel/preview-url - получить ссылку для предпросмотра (admin)
router.get('/preview-url', isAdmin, (req, res) => {
  const startParam = req.query.startParam as string | undefined;
  res.json({ url: buildMiniAppUrl(startParam) });
});

export default router;
