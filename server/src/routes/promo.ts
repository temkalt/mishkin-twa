import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = Router();

// POST /api/promo/validate — проверить промокод (публичный)
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Promo code is required' });
      return;
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
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
  try {
    const { code, discountType, discountValue, usageLimit } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      res.status(400).json({ error: 'code, discountType, discountValue are required' });
      return;
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue: discountType === 'FIXED' ? Math.round(discountValue * 100) : discountValue,
        usageLimit: usageLimit || 0,
      },
    });

    res.status(201).json(promo);
  } catch (error) {
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
