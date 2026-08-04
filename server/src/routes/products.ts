import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = Router();

// GET /api/products — список товаров (публичный)
router.get('/', async (req, res) => {
  try {
    const { category, featured } = req.query;

    const where: Record<string, unknown> = { inStock: true };

    if (category && category !== 'Все') {
      where.category = category as string;
    }
    if (featured === 'true') {
      where.isFeatured = true;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Parse JSON images field
    const parsed = products.map((p) => ({
      ...p,
      images: JSON.parse(p.images),
      price: p.price / 100, // конвертируем копейки в рубли для фронта
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/categories — уникальные категории
router.get('/categories', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { inStock: true },
      select: { category: true },
      distinct: ['category'],
    });
    const categories = ['Все', ...products.map((p) => p.category)];
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/products/:id — один товар
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({
      ...product,
      images: JSON.parse(product.images),
      price: product.price / 100,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products — создать товар (admin)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { name, slug, description, price, category, topNote, heartNote, baseNote, images, isFeatured } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description: description || '',
        price: Math.round(price * 100), // рубли -> копейки
        category,
        topNote: topNote || '',
        heartNote: heartNote || '',
        baseNote: baseNote || '',
        images: JSON.stringify(images || []),
        isFeatured: isFeatured || false,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id — обновить товар (admin)
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const data: Record<string, unknown> = { ...req.body };

    // Конвертируем цену если передана
    if (data.price !== undefined) {
      data.price = Math.round((data.price as number) * 100);
    }
    if (data.images !== undefined) {
      data.images = JSON.stringify(data.images);
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id — удалить (скрыть) товар (admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await prisma.product.update({
      where: { id },
      data: { inStock: false },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
