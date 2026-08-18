FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Клиент Prisma и сборка TypeScript — оба нужны до запуска.
RUN npx prisma generate && npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# devDependencies в рантайме не нужны, но prisma CLI нужен для migrate deploy.
RUN npm ci --omit=dev && npm install --no-save prisma@6.19.3

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
