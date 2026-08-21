import { Router } from 'express';
import { z } from 'zod';
import { isAdmin } from '../middleware/isAdmin.js';
import { checkBotIsAdmin, publishPost, buildMiniAppUrl } from '../lib/channelPost.js';

const router = Router();

// Лимиты Telegram: 4096 символов на сообщение и 1024 на подпись к фото.
// Без схемы здесь принимался любой req.body, и пост в канал уходил с
// произвольными полями — включая ссылку на картинку любой длины.
const postSchema = z
  .object({
    text: z.string().max(4096).optional().default(''),
    photoUrl: z.string().trim().max(2048).optional(),
    buttonText: z.string().trim().min(1).max(64).optional(),
    startParam: z
      .string()
      .trim()
      .max(64)
      // Telegram допускает в startapp только [A-Za-z0-9_-].
      .regex(/^[A-Za-z0-9_-]*$/, 'В параметре запуска допустимы только буквы, цифры, _ и -')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.text.trim() && !data.photoUrl) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: 'Текст или фото обязательны' });
    }
    if (data.photoUrl && data.text.length > 1024) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: 'С фото подпись не длиннее 1024 символов' });
    }
    if (data.photoUrl && !/^https?:\/\//i.test(data.photoUrl)) {
      ctx.addIssue({ code: 'custom', path: ['photoUrl'], message: 'Ссылка должна начинаться с http(s)' });
    }
  });

// POST /api/channel/post — создать пост в канале (admin)
router.post('/post', isAdmin, async (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некорректные данные поста' });
    return;
  }
  const { text, photoUrl, buttonText, startParam } = parsed.data;

  try {
    const channelId = process.env.CHANNEL_ID;
    if (!channelId) {
      res.status(500).json({ error: 'CHANNEL_ID не настроен' });
      return;
    }

    const isAdminInChannel = await checkBotIsAdmin(channelId);
    if (!isAdminInChannel) {
      res.status(403).json({
        error: `Бот не является администратором в канале ${channelId}. Добавьте бота в канал и дайте ему права на публикацию сообщений.`,
      });
      return;
    }

    const message = await publishPost(channelId, text, photoUrl, buttonText, startParam);

    res.json({
      success: true,
      messageId: message.message_id,
      channelId,
      url: buildMiniAppUrl(startParam),
    });
  } catch (error: any) {
    console.error('[channel] публикация не удалась:', error);
    res.status(error?.status || 500).json({ error: error?.message || 'Не удалось опубликовать пост' });
  }
});

// GET /api/channel/preview-url — ссылка для предпросмотра (admin)
router.get('/preview-url', isAdmin, (req, res) => {
  const startParam = typeof req.query.startParam === 'string' ? req.query.startParam : undefined;
  try {
    res.json({ url: buildMiniAppUrl(startParam) });
  } catch (error: any) {
    res.status(error?.status || 500).json({ error: error?.message || 'Не удалось построить ссылку' });
  }
});

export default router;
