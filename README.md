# MISHKIN — Telegram Mini App магазина свечей

Telegram Web App: каталог свечей, корзина, оформление заказа с доставкой и
онлайн-оплатой, уведомления в бота, админ-панель (заказы, товары, промокоды,
рассылка, посты в канал).

## Стек

| Слой | Технологии |
|---|---|
| Фронт | React 19, TypeScript, Vite, Zustand, Framer Motion, Tailwind, lucide-react |
| Бэк | Express 5, Prisma, PostgreSQL, Telegraf, Zod |
| Оплата | ЮKassa API v3 (+ встроенный эмулятор для разработки) |
| Хостинг | Vercel: фронт и бэк — два проекта, деплой из GitHub |

Цены везде хранятся **в копейках** (`2800 ₽` → `280000`); в рубли переводит API
на границе ответа.

## Структура

```
src/                 фронт (страницы, сторы Zustand, утилиты)
server/src/routes/    REST: products, orders, promo, users, channel, payments
server/src/lib/       bot, prisma, yookassa, paymentService, delivery, ipAllowlist
server/src/middleware validateTelegram (подпись initData), isAdmin
server/prisma/        schema.prisma, migrations/, seed.ts
ARCHITECTURE.md       как устроено
PRODUCTION_PLAN.md    что сделано и что осталось до прода
```

## Быстрый старт

Нужен Node 24+ и PostgreSQL. Docker для локальной разработки не обязателен:
достаточно бесплатной базы в Neon или Supabase — строку подключения кладём в
`server/.env`.

```bash
# 1. Бэкенд
cd server
cp .env.example .env          # заполнить BOT_TOKEN, DATABASE_URL, ADMIN_IDS
npm install
npm run db:deploy             # применить миграции
npm run db:seed               # демо-товары и промокоды (опционально)
npm run dev                   # http://localhost:3000

# 2. Фронтенд (из корня проекта, в другом терминале)
npm install
npm run dev                   # http://localhost:5173
```

В браузере (без Telegram) API отклонит запросы без подписи initData. Чтобы
показать магазин заказчику ссылкой, поставьте `ALLOW_BROWSER_DEMO=true` — тогда
запросы без подписи выполняются от «Гостя». В проде это выключено.

## Переменные окружения (`server/.env`)

| Переменная | Зачем |
|---|---|
| `DATABASE_URL` | Postgres (через pooler, если Neon/Supabase) |
| `DIRECT_URL` | Прямое подключение — нужно Prisma для миграций |
| `BOT_TOKEN` | токен бота из @BotFather; им же проверяется подпись initData |
| `BOT_USERNAME`, `BOT_APP_NAME` | для ссылок вида `t.me/bot/app?startapp=…` |
| `ADMIN_IDS` | Telegram ID админов через запятую — доступ в админку и уведомления о заказах |
| `WEBAPP_URL`, `PUBLIC_URL` | адрес фронта и адрес самого API (CORS, return_url оплаты) |
| `CHANNEL_ID`, `CHANNEL_URL` | канал для постов из админки |
| `WEBHOOK_SECRET` | секрет вебхука бота (проверяется заголовок Telegram) |
| `SETUP_SECRET` | пароль к `/api/setup-webhook` |
| `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` | реквизиты ЮKassa; пусто → эмулятор |
| `YOOKASSA_MODE` | `auto` (по умолчанию), `mock` или `real` |
| `YOOKASSA_SEND_RECEIPT`, `YOOKASSA_VAT_CODE` | чеки 54-ФЗ |
| `YOOKASSA_WEBHOOK_CHECK_IP` | `false` отключает проверку IP уведомлений (для отладки) |
| `ALLOW_BROWSER_DEMO` | разрешить работу вне Telegram (демо заказчику) |

Фронт: `VITE_API_URL` (по умолчанию `/api`).

## Оплата

Три режима, переключаются только переменными окружения:

1. **Эмулятор** (нет ключей ЮKassa) — платёж подтверждается вручную на странице
   `/api/payments/mock/:paymentId`. Сквозной поток «заказ → оплата → статус
   Оплачен» проверяется без реквизитов и без денег.
2. **Sandbox ЮKassa** — тестовый магазин, ключ `test_…`, тестовые карты.
   Интерфейс честно помечает, что контур тестовый.
3. **Боевой** — ключ `live_…` на ИП заказчика. Чеки 54-ФЗ ЮKassa делает сама.

Уведомления от ЮKassa приходят на `POST /api/payments/webhook`. Подлинность
проверяется дважды: по IP отправителя и перезапросом статуса через API —
подделать ответ `api.yookassa.ru` нельзя. Повторные уведомления гасит журнал
`PaymentEvent` (идемпотентность). Если вебхук не дошёл, приложение само
опрашивает `GET /api/payments/status/:orderId`.

## База и миграции

Схема ведётся **только миграциями**. `prisma db push` в проде не используется:
из-за него схема и база разъезжались, и создание заказа падало на чистой Postgres.

```bash
cd server
npm run db:migrate -- --name add_something   # изменить схему локально
npm run db:deploy                            # применить в целевой базе
npm run db:check                             # что с базой: миграции, колонки, счётчики
```

Проверки, которые не трогают рабочие данные (создают и удаляют временную схему
в той же базе):

```bash
npm run test:migrations   # миграции на чистой базе и на базе после db push
npm run test:e2e          # заказ → оплата эмулятором → статус PAID + права доступа
```

Если база уже создавалась через `db push` (в ней есть таблицы, но нет
`_prisma_migrations`), её нужно один раз «забаселайнить», иначе `migrate deploy`
упадёт на существующих таблицах:

```bash
npx prisma migrate resolve --applied 20260804030602_init_pg
npx prisma migrate resolve --applied 20260817234247_sync_orders_payments
```

## Деплой на Vercel

Два проекта из одного репозитория:

| Проект | Root Directory | Что делает |
|---|---|---|
| фронт | `.` | Vite-сборка; `vercel.json` проксирует `/api/*` на бэкенд и отдаёт SPA-fallback |
| бэк | `server` | `@vercel/node` поднимает `src/index.ts`; `vercel-build` применяет миграции |

Порядок:

1. Завести управляемую Postgres (Neon/Supabase), прописать `DATABASE_URL` и
   `DIRECT_URL` в переменные бэкенд-проекта (для Build и Runtime — миграции
   применяются на сборке).
2. Прописать остальные переменные из таблицы выше.
3. Адрес бэкенда указать в `vercel.json` фронта (`rewrites.destination`) и в
   `PUBLIC_URL` бэкенда.
4. Установить вебхук бота: `GET /api/setup-webhook?secret=<SETUP_SECRET>`.
5. В личном кабинете ЮKassa указать URL уведомлений:
   `https://<бэкенд>/api/payments/webhook`.
6. В @BotFather задать Mini App URL — адрес фронта.

При `process.env.VERCEL` бот не поднимает polling и работает вебхуком —
локально наоборот, polling.

Docker-конфигурация (`docker-compose.yml`, `server/Dockerfile`) оставлена как
альтернатива для self-hosted VPS: Postgres в compose, `migrate deploy` на старте,
запуск собранного `node dist/index.js`. Локально она не проверялась.

## Админка

Открывается по `/admin` тем, чей Telegram ID есть в `ADMIN_IDS`. Разделы:
статистика, заказы (смена статуса + трек-номер, виден статус оплаты), товары
(несколько фото — по ссылке в строке), промокоды, рассылка по пользователям бота,
пост в канал с кнопкой в Mini App.

## CI

`.github/workflows/ci.yml` на каждый PR: линт и сборка фронта, сборка бэка,
а также прогон миграций на чистой Postgres с проверкой, что схема и миграции
не разошлись.

## Что дальше

Состояние готовности к продакшену, оставшиеся задачи и приоритеты —
в [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md).


