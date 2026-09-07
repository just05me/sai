# Sai Web 1.0

Браузерная среда для структурирования идей через три связанных дерева знаний (Разработка / Функции / Бизнес) с AI-ассистентом и BYOK.

**Режим:** только self-host. Регистрация не нужна — локальный пользователь создаётся автоматически.

Стек: Next.js 15, React 19, TypeScript, Prisma, PostgreSQL + pgvector, tRPC, React Flow.

Постановка продукта: [docs/VISION.md](docs/VISION.md)

## Что внутри 1.0

- Канвас с тремя деревьями и Mind Map View
- Синхронизация деревьев (анализ + bridge)
- AI-чат по узлу, BYOK, 5 персон
- Экспорт MD / PDF / TXT / JSON / Mermaid
- 20 публичных шаблонов (seed при первом Docker-старте)
- Command palette, Quick Capture, i18n RU/EN

## Запуск (dev)

Нужны Node.js 22+ и Docker (Postgres) либо свой Postgres с pgvector.

```bash
cp .env.example .env
# AUTH_SECRET=$(openssl rand -base64 32)
# BYOK_SERVER_SECRET=$(openssl rand -base64 32)

npm install --legacy-peer-deps
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate dev
npm run db:seed
npm run dev
```

Dev-Postgres слушает порт **5434** — укажите его в `DATABASE_URL` и `DIRECT_URL`.

Открой http://localhost:3000

## Self-host (Docker Compose)

```bash
cp .env.example .env
# задай AUTH_SECRET, BYOK_SERVER_SECRET, NEXT_PUBLIC_APP_URL

docker compose up -d
```

Приложение: http://localhost:3000

Сервис `sai-migration` выполняет миграции и seed шаблонов при первом запуске.

## Проверки

```bash
npm run test
npm run build
npm run typecheck
npm run lint
npx playwright test   # нужен запущенный dev-сервер или CI
```

## Лицензия

LGPL — см. [LICENSE](LICENSE).
