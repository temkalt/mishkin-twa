// Сборка бэкенда на Vercel.
//
// Зачем отдельный скрипт: миграции должны применяться при каждом деплое, иначе
// схема Prisma и база расходятся (именно из-за этого создание заказа падало на
// «чистой» Postgres). `prisma migrate deploy` безопасен — применяет только
// новые миграции и ничего не удаляет.
//
// Если DATABASE_URL не задан (например, превью-сборка без базы), деплой не
// валим: печатаем предупреждение и идём дальше — но тогда миграции нужно
// применить вручную: npx prisma migrate deploy

import { execSync } from 'node:child_process';

function run(command) {
  console.log(`[build] ${command}`);
  execSync(command, { stdio: 'inherit' });
}

run('prisma generate');

if (process.env.DATABASE_URL) {
  run('prisma migrate deploy');
} else {
  console.warn('[build] DATABASE_URL не задан — миграции пропущены.');
  console.warn('[build] Примените их вручную: npx prisma migrate deploy');
}
