# Changelog

All notable changes to Sai are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-09-07

### Added

- **Mind Map View** — переключение Graph ↔ Mind Map на канвасе (d3-hierarchy layout)
- **Three-tree sync** — анализ несоответствий DEV/FUNC/BIZ, создание bridge-связей
- **PDF export** — синхронная генерация через `@react-pdf/renderer` (без Chromium/воркеров)
- Unit-тесты: SyncService, PDF export, in-memory rate limiter
- E2E golden path: проект → узлы → чат → экспорт, Mind Map, sync-диалог
- `docs/VISION.md` — актуализированная постановка продукта
- Docker: автоматический seed шаблонов при первом старте (`prisma/seed.cjs`)
- Строгий CI: typecheck, lint без `|| true`, e2e с Postgres + приложением

### Changed

- **Selfhost-only:** удалены cloud-режим, Stripe/billing, OAuth/magic-link UI
- Удалён мёртвый стек: Hocuspocus/Yjs collab, BullMQ workers, Redis, PostHog, MinIO
- NotificationService — только запись в БД (без email-очереди)
- SnapshotService — снимки из состояния Postgres (не Yjs CRDT)
- Rate limiter — in-memory (без Redis)
- Версия пакета: `1.0.0`

### Removed

- `src/collab/`, `src/workers/`, billing-страницы, Stripe webhooks
- RAG-скелет `AIMemoryService` (pgvector в миграциях сохранён)
- Зависимости: ioredis, bullmq, stripe, yjs/hocuspocus, resend, nodemailer, posthog

### Deferred to 1.1+

- Real-time collaboration (Yjs)
- Cloud SaaS + Stripe
- OAuth / magic-link auth
- Redis + фоновые очереди

## [0.0.5] — 2026-06-13

Промежуточная веб-версия с полным (но неиспользуемым) cloud/collab/worker-стеком.

## [0.0.4] — 2026-06-08

Десктоп-прототип: Manhattan routing, rubber band, canvas search.

## [0.0.1] — 2026-05-18

Первый десктопный прототип (Python/PySide6).
