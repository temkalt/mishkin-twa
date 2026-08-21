import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = Router();

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, 'slug: только латиница, цифры и дефис').optional(),
  description: z.string().trim().max(4000).default(''),
  price: z.number().positive().max(10_000_000),
  category: z.string().trim().min(1).max(60),
  topNote: z.string().trim().max(120).default(''),
  heartNote: z.string().trim().max(120).default(''),
  baseNote: z.string().trim().max(120).default(''),
  images: z.array(z.string().trim().max(3_000_000)).max(15).default([]),
  inStock: z.boolean().default(true),
  /** Остаток в штуках. `null` — учёт не ведётся, товар всегда доступен. */
  stock: z.number().int().min(0).max(1_000_000).nullable().default(null),
  isFeatured: z.boolean().default(false),
});

/** На обновление принимаем те же поля, но все опциональные. */
const productUpdateSchema = productSchema.partial();

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

    // images в базе — строка JSON (см. CLAUDE.md), а цена — копейки: делим ровно
    // здесь, на границе ответа. Клиент, получивший копейки, покажет цену в 100 раз
    // больше — эта ошибка уже случалась в share() на карточке товара.
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

/**
 * GET /api/products/admin/all — все товары, включая скрытые (admin).
 * Публичный список отдаёт только `inStock: true`, поэтому «удалённый» товар
 * иначе исчезал из админки навсегда и его нельзя было вернуть в продажу.
 */
router.get('/admin/all', isAdmin, async (_req, res) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(products.map((p) => ({ ...p, images: JSON.parse(p.images), price: p.price / 100 })));
  } catch (error) {
    console.error('Error fetching all products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
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

function slugify(text: string): string {
  const ru: Record<string, string> = {
    а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'yo', ж:'zh', з:'z', и:'i', й:'y',
    к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
    х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'shch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya',
  };
  const s = text
    .toLowerCase()
    .split('')
    .map((char) => ru[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || `item-${Date.now()}`;
}

// POST /api/products — создать товар (admin)
router.post('/', isAdmin, async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некорректные данные товара' });
    return;
  }

  try {
    const { price, images, slug, ...rest } = parsed.data;
    const finalSlug = slug || slugify(rest.name);
    const product = await prisma.product.create({
      data: {
        ...rest,
        slug: finalSlug,
        price: Math.round(price * 100), // рубли -> копейки
        images: JSON.stringify(images),
      },
    });

    res.status(201).json(product);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'Товар с таким slug уже есть' });
      return;
    }
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id — обновить товар (admin)
router.put('/:id', isAdmin, async (req, res) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некорректные данные товара' });
    return;
  }

  try {
    const id = parseInt(String(req.params.id), 10);

    // Явный whitelist: в prisma.update летят только известные поля, а не весь body.
    const { price, images, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (price !== undefined) data.price = Math.round(price * 100);
    if (images !== undefined) data.images = JSON.stringify(images);

    const product = await prisma.product.update({ where: { id }, data });
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
