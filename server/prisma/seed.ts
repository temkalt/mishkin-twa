import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // --- Products ---
  const products = [
    {
      name: 'Lavender Mist',
      slug: 'lavender-mist',
      description: 'Авторское изделие ручной работы. Премиальные экологичные материалы, внимание к деталям и уникальный дизайн. Прекрасно дополнит уютную атмосферу любого интерьера.',
      price: 280000,
      category: 'Декор',
      topNote: '',
      heartNote: '',
      baseNote: '',
      images: JSON.stringify(['/images/candle_1.jpg']),
      stock: 12,
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Midnight Vanilla',
      slug: 'midnight-vanilla',
      description: 'Элегантный предмет интерьера ручной работы. Изготовлен из натуральных материалов с заботой о каждой линии. Идеально подходит для создания гармоничной обстановки.',
      price: 350000,
      category: 'Декор',
      topNote: '',
      heartNote: '',
      baseNote: '',
      images: JSON.stringify(['/images/candle_2.jpg']),
      stock: 8,
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Forest Rain',
      slug: 'forest-rain',
      description: 'Лаконичный авторский декор для дома. Природная фактура, эстетичная форма и ручное исполнение, подчеркивающее индивидуальность вашего пространства.',
      price: 250000,
      category: 'Декор',
      topNote: '',
      heartNote: '',
      baseNote: '',
      images: JSON.stringify(['/images/candle_3.jpg']),
      stock: 10,
      inStock: true,
      isFeatured: false,
    },
    {
      name: 'Aurora Borealis',
      slug: 'aurora-borealis',
      description: 'Эксклюзивное изделие особой серии. Утончённая ручная работа с уникальной текстурой и благородным оттенком. Создано в ограниченном тираже.',
      price: 450000,
      category: 'Декор',
      topNote: '',
      heartNote: '',
      baseNote: '',
      images: JSON.stringify(['/images/limit_1.jpg']),
      stock: 3,
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Golden Hour',
      slug: 'golden-hour',
      description: 'Авторский элемент декора теплого золотистого оттенка. Ручное формование, экологически чистая основа и неповторимый характер каждого экземпляра.',
      price: 520000,
      category: 'Декор',
      topNote: '',
      heartNote: '',
      baseNote: '',
      images: JSON.stringify(['/images/limit_2.jpg']),
      stock: 2,
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Velvet Night',
      slug: 'velvet-night',
      description: 'Интерьерный акцент глубокого благородного дизайна. Ручная работа высочайшего качества для ценителей эстетики и комфорта.',
      price: 480000,
      category: 'Декор',
      topNote: '',
      heartNote: '',
      baseNote: '',
      images: JSON.stringify(['/images/limit_3.jpg']),
      stock: 0,
      inStock: true,
      isFeatured: false,
    },
  ];

  for (const product of products) {
    // Остаток — операционные данные заказчика: повторный сев обновляет описания
    // и цены, но не затирает склад. При первом создании берём значение отсюда.
    const { stock, ...withoutStock } = product;
    void stock;
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: withoutStock,
      create: product,
    });
  }
  console.log(`  ✅ ${products.length} products seeded`);

  // --- Promo codes ---
  const promoCodes = [
    {
      code: 'MISHKIN10',
      discountType: 'PERCENT',
      discountValue: 10,
      isActive: true,
      usageLimit: 0,
    },
    {
      code: 'WELCOME',
      discountType: 'FIXED',
      discountValue: 50000, // 500₽
      isActive: true,
      usageLimit: 100,
    },
  ];

  for (const promo of promoCodes) {
    await prisma.promoCode.upsert({
      where: { code: promo.code },
      update: promo,
      create: promo,
    });
  }
  console.log(`  ✅ ${promoCodes.length} promo codes seeded`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
