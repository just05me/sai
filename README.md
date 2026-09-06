# Sai Web 1.0

Браузерная среда для структурирования идей через три связанных дерева знаний (Разработка / Функции / Бизнес) с AI-ассистентом и BYOK.

Стек: Next.js 15, React 19, TypeScript, Prisma, PostgreSQL + pgvector, tRPC, React Flow.

## Запуск (dev)

Нужны Node.js 22+ и Docker (для Postgres) либо свой Postgres с pgvector.

```bash
cp .env.example .env
# AUTH_SECRET=$(openssl rand -base64 32)
# BYOK_SERVER_SECRET=$(openssl rand -base64 32)

npm install --legacy-peer-deps
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate dev
npm run dev
```

Открой http://localhost:3000. Dev-Postgres слушает порт `5434` — в `.env` поставь его в `DATABASE_URL` и `DIRECT_URL` вместо `5432`.

## Self-host (Docker Compose)

```bash
cp .env.example .env
# задай AUTH_SECRET, BYOK_SERVER_SECRET, NEXT_PUBLIC_APP_URL

docker compose up -d
```

Приложение: http://localhost:3000. Миграции выполняет сервис `sai-migration`.

Лицензия: LGPL — см. [LICENSE](LICENSE).
