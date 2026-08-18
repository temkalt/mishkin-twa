import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = Router();

const validateSchema = z.object({
  code: z.string().trim().min(1, 'Введите промокод').max(40),
});

const createSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Код: латиница, цифры, дефис'),
  discountType: z.enum(['PERCENT', 'FIXED']),
  discountValue: z.number().positive(),
  usageLimit: z.number().int().min(0).max(1_000_000).default(0),
}).superRefine((data, ctx) => {
  if (data.discountType === 'PERCENT' && data.discountValue > 100) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Процент не может быть больше 100' });
  }
});

// POST /api/promo/validate — проверить промокод (публичный)
router.post('/validate', async (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Введите промокод' });
    return;
  }

  try {
    const promo = await prisma.promoCode.findUnique({
      where: { code: parsed.data.code.toUpperCase() },
    });

    if (!promo || !promo.isActive) {
      res.status(404).json({ error: 'Промокод не найден или неактивен' });
      return;
    }

    if (promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit) {
      res.status(410).json({ error: 'Промокод исчерпан' });
      return;
    }

    res.json({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountType === 'FIXED' ? promo.discountValue / 100 : promo.discountValue,
    });
  } catch (error) {
    console.error('Error validating promo:', error);
    res.status(500).json({ error: 'Failed to validate promo code' });
  }
});

// GET /api/promo — все промокоды (admin)
router.get('/', isAdmin, async (_req, res) => {
  try {
    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const parsed = promos.map((p) => ({
      ...p,
      discountValue: p.discountType === 'FIXED' ? p.discountValue / 100 : p.discountValue,
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching promos:', error);
    res.status(500).json({ error: 'Failed to fetch promo codes' });
  }
});

// POST /api/promo — создать промокод (admin)
router.post('/', isAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некорректные данные промокода' });
    return;
  }

  try {
    const { code, discountType, discountValue, usageLimit } = parsed.data;
    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue: discountType === 'FIXED' ? Math.round(discountValue * 100) : Math.round(discountValue),
        usageLimit,
      },
    });

    res.status(201).json(promo);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'Такой промокод уже есть' });
      return;
    }
    console.error('Error creating promo:', error);
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

// DELETE /api/promo/:id — деактивировать промокод (admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await prisma.promoCode.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating promo:', error);
    res.status(500).json({ error: 'Failed to deactivate promo code' });
  }
});

export default router;
