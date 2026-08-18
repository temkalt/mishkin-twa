#!/bin/sh
set -e

# Применяем миграции, а не db push: схема и миграции должны совпадать,
# иначе на чистой базе не хватит колонок и заказы будут падать.
echo "Applying database migrations..."
npx prisma migrate deploy

# Сид только по явному запросу (SEED_ON_START=true) — в прод-контейнере
# автоматический сид перетирал бы товары заказчика при каждом рестарте.
if [ "$SEED_ON_START" = "true" ]; then
  if [ -f dist/prisma/seed.js ]; then
    echo "Seeding database..."
    node dist/prisma/seed.js
  else
    echo "SEED_ON_START=true, но dist/prisma/seed.js не собран — сид пропущен."
    echo "Заполните каталог через админку или локально: npm run db:seed"
  fi
fi

# Запускаем собранный JS, а не tsx: tsx — дев-рантайм.
echo "Starting backend server..."
exec node dist/index.js
