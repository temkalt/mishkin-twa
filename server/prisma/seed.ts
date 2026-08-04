import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // --- Products ---
  const products = [
    {
      name: 'Lavender Mist',
      slug: 'lavender-mist',
      description: 'Наш процесс производства чтит традиционные методы. Мы смешиваем премиальный соевый воск с эфирными маслами, полученными от фермеров Прованса. Только чистое, длительное горение.',
      price: 280000,
      category: 'Ароматические',
      topNote: 'Бергамот',
      heartNote: 'Лаванда',
      baseNote: 'Кедр',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?q=80&w=800&auto=format&fit=crop',
      ]),
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Midnight Vanilla',
      slug: 'midnight-vanilla',
      description: 'Глубокий, обволакивающий аромат мадагаскарской ванили с тёплыми нотами мускуса. Создана для вечернего ритуала медитации и расслабления.',
      price: 350000,
      category: 'Бестселлеры',
      topNote: 'Корица',
      heartNote: 'Ваниль',
      baseNote: 'Мускус',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=800&auto=format&fit=crop',
      ]),
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Forest Rain',
      slug: 'forest-rain',
      description: 'Прогулка после дождя в хвойном лесу. Свежие ноты петричора, еловой хвои и мокрого мха создают атмосферу абсолютного спокойствия.',
      price: 250000,
      category: 'Ароматические',
      topNote: 'Эвкалипт',
      heartNote: 'Хвоя',
      baseNote: 'Мох',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1572726729207-a78d6feb18d7?q=80&w=800&auto=format&fit=crop',
      ]),
      inStock: true,
      isFeatured: false,
    },
    {
      name: 'Citrus Bloom',
      slug: 'citrus-bloom',
      description: 'Взрывной цитрусовый микс с нежными цветочными оттенками. Идеальный компаньон для утреннего пробуждения и заряда энергии на весь день.',
      price: 280000,
      category: 'Летние',
      topNote: 'Грейпфрут',
      heartNote: 'Нероли',
      baseNote: 'Белый чай',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1608181831718-2501dfbe8ed1?q=80&w=800&auto=format&fit=crop',
      ]),
      inStock: true,
      isFeatured: false,
    },
    {
      name: 'Cedar Warmth',
      slug: 'cedar-warmth',
      description: 'Тёплый, древесный аромат с нотами сандала и кашемирового дерева. Вызывает ощущение уютного вечера у камина зимой.',
      price: 320000,
      category: 'Бестселлеры',
      topNote: 'Бергамот',
      heartNote: 'Сандал',
      baseNote: 'Кашемировое дерево',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1599446220523-b35eb357228c?q=80&w=800&auto=format&fit=crop',
      ]),
      inStock: true,
      isFeatured: true,
    },
    {
      name: 'Rose Garden',
      slug: 'rose-garden',
      description: 'Роскошный букет из дамасской розы, пиона и белого жасмина. Элегантная свеча для особых моментов и романтических вечеров.',
      price: 380000,
      category: 'Декоративные',
      topNote: 'Пион',
      heartNote: 'Дамасская роза',
      baseNote: 'Амбра',
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1616401784845-180882c62e94?q=80&w=800&auto=format&fit=crop',
      ]),
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
