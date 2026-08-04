import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // --- Products ---
  const products = [
    {
      name: 'Lavender Mist',
      slug: 'lavender-mist',
      description: 'Наш процесс производства чтит традиционные методы. Мы смешиваем премиальный соевый воск с эфирными маслами, полученными от фермеров Прованса. Только чистое, длительное горение. Время горения — до 45 часов.',
      price: 280000,
      category: 'Ароматические',
      topNote: 'Бергамот',
      heartNote: 'Лаванда',
      baseNote: 'Кедр',
      images: JSON.stringify(['/images/candle_1.jpg']),
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Midnight Vanilla',
      slug: 'midnight-vanilla',
      description: 'Глубокий, обволакивающий аромат мадагаскарской ванили с тёплыми нотами мускуса. Создана для вечернего ритуала медитации и расслабления. Время горения — до 50 часов.',
      price: 350000,
      category: 'Бестселлеры',
      topNote: 'Корица',
      heartNote: 'Ваниль',
      baseNote: 'Мускус',
      images: JSON.stringify(['/images/candle_2.jpg']),
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Forest Rain',
      slug: 'forest-rain',
      description: 'Прогулка после дождя в хвойном лесу. Свежие ноты петричора, еловой хвои и мокрого мха создают атмосферу абсолютного спокойствия. Время горения — до 40 часов.',
      price: 250000,
      category: 'Ароматические',
      topNote: 'Эвкалипт',
      heartNote: 'Хвоя',
      baseNote: 'Мох',
      images: JSON.stringify(['/images/candle_3.jpg']),
      inStock: true,
      isFeatured: false,
    },
    {
      name: 'Aurora Borealis',
      slug: 'aurora-borealis',
      description: 'Лимитированная свеча с переливающимся перламутровым воском. Аромат северного сияния — свежий озон, ледяная мята и тёплый кашемир. Время горения — до 55 часов.',
      price: 450000,
      category: 'Лимитированные',
      topNote: 'Озон',
      heartNote: 'Ледяная мята',
      baseNote: 'Кашемир',
      images: JSON.stringify(['/images/limit_1.jpg']),
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Golden Hour',
      slug: 'golden-hour',
      description: 'Эксклюзивная свеча из коллекции «Золотой час». Тёплые ноты амбры, сандала и мёда создают атмосферу заката на средиземноморском побережье. Время горения — до 60 часов.',
      price: 520000,
      category: 'Лимитированные',
      topNote: 'Бергамот',
      heartNote: 'Мёд',
      baseNote: 'Амбра',
      images: JSON.stringify(['/images/limit_2.jpg']),
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Velvet Night',
      slug: 'velvet-night',
      description: 'Бархатная ночь в стекле. Роскошный букет из дамасской розы, пиона и белого жасмина. Элегантная свеча для особых моментов. Время горения — до 50 часов.',
      price: 480000,
      category: 'Лимитированные',
      topNote: 'Пион',
      heartNote: 'Дамасская роза',
      baseNote: 'Амбра',
      images: JSON.stringify(['/images/limit_3.jpg']),
      inStock: true,
      isFeatured: false,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
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
