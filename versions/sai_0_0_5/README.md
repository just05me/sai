# Sai Web · v0.0.5

> Браузерная среда для структурирования идей через **три связанных дерева знаний** (Разработка / Функции / Бизнес) с AI-ассистентом, BYOK и real-time коллаборацией.
>
> Полная реализация на основе канонического ТЗ [`ТЗ/sai.md`](../../ТЗ/sai.md).

## Содержание

1. [Что внутри](#что-внутри)
2. [Быстрый старт (dev)](#быстрый-старт-dev)
3. [Быстрый старт (Docker Compose, self-host)](#быстрый-старт-docker-compose-self-host)
4. [Архитектура](#архитектура)
5. [Структура проекта](#структура-проекта)
6. [BYOK и безопасность](#byok-и-безопасность)
7. [Покрытие требований ТЗ](#покрытие-требований-тз)
8. [Что НЕ сделано (для будущих версий)](#что-не-сделано)

---

## Что внутри

- **Next.js 15** (App Router) · **React 19** · **TypeScript 5.7** · **Tailwind 3.4** · **shadcn/ui-стиль primitives**
- **Prisma 5** + **PostgreSQL 16** + **pgvector** (semantic search и Team AI Memory RAG)
- **Auth.js v5** — magic link (Resend / Nodemailer) + Google + GitHub OAuth, Prisma Adapter
- **tRPC v11** + **TanStack Query** + **Zustand** + **superjson**
- **React Flow 12** канвас с тремя деревьями, CrossTreeEdge, Minimap, Focus Mode, Mind Map layouts (Radial / Hierarchical / Force-directed / Free)
- **TipTap 2** редактор с DOMPurify-санитизацией
- **Vercel AI SDK 4** + провайдеры OpenAI / Anthropic / OpenRouter / Ollama / Custom (OpenAI-compatible)
- **Yjs 13** + **Hocuspocus 2** (CRDT-сервер с Postgres persistence, IndexedDB локальный fallback)
- **BullMQ 5** + **Redis 7** — очереди для AI, email, webhooks, PDF-экспорта
- **Stripe** биллинг (cloud-only) + **Limit Gate UX** (Free 5 проектов / 100 узлов)
- **next-intl** — RU/EN из коробки, авто-детект по `Accept-Language` и cookie
- **Workbox-like Service Worker** + IndexedDB cache (заглушка под полный offline)
- **next-themes** — Light / Dark / System
- **Docker Compose** с профилями: базовые сервисы, `pdf` (Playwright + Chromium), `monitoring` (Prometheus + Grafana)
- **Vitest** — unit-тесты для BYOK криптографии и layout-алгоритмов

## Быстрый старт (dev)

```bash
# 1. Зависимости
cd versions/sai_0_0_5
npm install --legacy-peer-deps

# 2. ENV
cp .env.example .env
# обязательно сгенерируй:
#   AUTH_SECRET=$(openssl rand -base64 32)
#   BYOK_SERVER_SECRET=$(openssl rand -base64 32)
# и поправь DATABASE_URL под свой Postgres

# 3. Подними локально Postgres + Redis (можно через Docker Compose без app):
docker compose up -d postgres redis minio

# 4. Миграции и сидинг
npx prisma migrate dev --name init
npx prisma db seed

# 5. Параллельно три процесса:
npm run dev          # Next.js  → :3000
npm run collab       # Hocuspocus → :3001
npm run worker       # BullMQ workers
```

Открой `http://localhost:3000`.

## Быстрый старт (Docker Compose, self-host)

```bash
cd versions/sai_0_0_5
cp .env.example .env
# поправь AUTH_SECRET, BYOK_SERVER_SECRET, NEXT_PUBLIC_APP_URL

docker compose up -d
# миграции и сидинг выполнятся автоматически (sai-migration сервис)
```

После старта:
- App: http://localhost:3000
- Collab WS: ws://localhost:3001
- MinIO console: http://localhost:9001 (sai-dev / sai-dev-secret)

Опциональные профили:

```bash
docker compose --profile pdf up -d        # PDF-экспорт через Playwright
docker compose --profile monitoring up -d # Prometheus + Grafana
```

## Архитектура

```
Browser (React + Yjs + IndexedDB + SW)
   │ HTTPS/tRPC      │ WSS/Yjs           │ SSE/AI Streaming
   ▼                 ▼                   ▼
Next.js Route        Hocuspocus          AI Orchestrator
Handlers (tRPC,      (`src/collab/`)     (`/api/ai/*`, Vercel AI SDK)
SSE, REST)
   │                 │                   │
   ▼                 ▼                   ▼
Domain Services (`src/server/services/`):
  SyncService · BridgeService · MutationService · MindMapService
  ChatService · ProviderManager · UsageTracker · HistoryService
  SnapshotService · CollaborationService · ExportService
  ShareService · BillingService · WebhookService · AuthService
  AIMemoryService · NotificationService
   │                 │                   │
   ▼                 ▼                   ▼
PostgreSQL+pgvector  Redis + BullMQ     S3 (MinIO / R2)
                                          │
                                          ▼
                              External LLM (BYOK)
```

## Структура проекта

```
sai_0_0_5/
├── prisma/
│   ├── schema.prisma         # Полная схема: users, workspaces, projects,
│   │                         # trees, nodes, edges, snapshots, hypotheses,
│   │                         # BYOK, billing, share, webhooks, AI memory…
│   └── seed.ts               # 20 публичных шаблонов (F-134)
├── messages/                 # i18n словари ru.json / en.json
├── public/                   # manifest + service worker
├── ops/                      # Prometheus конфиг
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/           # signin / verify-request
│   │   ├── (app)/            # авторизованные страницы (sidebar)
│   │   │   ├── workspace/    # dashboard
│   │   │   ├── projects/     # canvas
│   │   │   └── settings/     # profile / keys / billing / shortcuts
│   │   ├── capture/          # Quick Capture (анонимно)
│   │   ├── explore/          # витрина шаблонов
│   │   ├── share/[token]/    # публичный read-only viewer
│   │   ├── page.tsx          # landing
│   │   └── api/              # tRPC, AI streaming, webhooks, export, health
│   ├── auth.ts               # Auth.js v5 main
│   ├── auth.config.ts        # edge-safe конфиг
│   ├── middleware.ts         # auth middleware
│   ├── env.ts                # zod-валидация env
│   ├── i18n/request.ts       # next-intl
│   ├── lib/
│   │   ├── byok.ts           # Web Crypto AES-256-GCM (клиент)
│   │   ├── exporters/        # markdown / json / mermaid
│   │   ├── hotkeys.ts        # справочник хоткеев (F-220)
│   │   ├── layouts.ts        # mind map: radial / hierarchical / force
│   │   ├── store.ts          # Zustand UI state
│   │   ├── utils.ts          # cn, TREE_META
│   │   └── yjs.ts            # Hocuspocus + IndexedDB клиент
│   ├── server/
│   │   ├── crypto.ts         # серверная половина BYOK + HMAC webhooks
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── ratelimit.ts
│   │   ├── ai/               # prompts, personas
│   │   ├── services/         # 17 domain services
│   │   └── trpc/             # context, root, routers
│   ├── components/
│   │   ├── ui/               # shadcn-style primitives
│   │   ├── canvas/           # ReactFlow canvas, NodeCard, NodeEditorPanel
│   │   ├── chat/             # GlobalChat (SSE), PersonaPicker, ProviderSwitcher
│   │   ├── sidebar/          # AppSidebar, HypothesisTracker
│   │   ├── command-palette.tsx
│   │   ├── key-setup-wizard.tsx  # BYOK UI (Cmd+K → шифруем в браузере)
│   │   ├── providers.tsx     # tRPC + QueryClient + ThemeProvider
│   │   └── theme-provider.tsx
│   ├── hooks/                # use-debounced-value
│   ├── collab/server.ts      # Hocuspocus standalone
│   └── workers/              # BullMQ workers (email, pdf, webhooks)
├── tests/                    # vitest: BYOK crypto, layouts
├── Dockerfile                # sai-app (≤500 МБ цель)
├── Dockerfile.worker         # sai-worker
├── Dockerfile.collab         # sai-collab (Hocuspocus)
├── Dockerfile.pdf            # sai-pdf-worker (~600 МБ, profile: pdf)
└── docker-compose.yml        # полная инфраструктура
```

## BYOK и безопасность

Реализована **модель нулевого знания сервера** (ТЗ §7.1):

1. **`src/lib/byok.ts`** — Web Crypto API в браузере.
   `PBKDF2(user_id || passphrase, salt, 250_000 iter)` → `AES-256-GCM` ключ.
   Шифрование API-ключа происходит **до отправки на сервер**.
2. **`src/server/crypto.ts`** — серверная расшифровка только в момент AI-запроса.
   `BYOK_SERVER_SECRET` примешивается через `deriveBYOKPassphrase(userId)`.
   Ключ существует в RAM миллисекунды, не логируется, не кешируется.
3. **`src/components/key-setup-wizard.tsx`** — UI пошаговой настройки с проверкой.
4. **`src/server/services/provider-manager.ts`** — фабрика LLM-клиентов
   (OpenAI / Anthropic / OpenRouter / Ollama / Custom).

Прочее:
- `next.config.mjs` — strict headers (CSP, HSTS, X-Frame-Options).
- `src/server/ratelimit.ts` — Redis token-bucket (5 r/min для auth, per-user для API).
- TipTap output санитизируется DOMPurify.

## Покрытие требований ТЗ

| Раздел ТЗ | Статус |
|---|---|
| **F-100…F-110 Auth** | Magic link + Google + GitHub + анонимная сессия Quick Capture ✓ · 2FA / SAML — заложен слот в схеме, реализация v1.5/v2.0 |
| **F-120…F-135 Workspaces** | Personal/Team workspaces, проекты CRUD, импорт/экспорт `.sai`, архивирование, дублирование, пин, search (text), command palette, шаблоны, public Explore ✓ |
| **F-200…F-225 Канвас** | React Flow 12 канвас, три дерева, CrossTreeEdge, Minimap, Focus, Mind Map (Radial/Hierarchical/Force), TipTap, темы, hotkeys (1/2/3/E/F/Tab/Esc/Cmd+K), Hypothesis Tracker ✓ |
| **F-300…F-311 Коллаборация** | Yjs + Hocuspocus + IndexedDB scaffold готов, presence/курсоры — заложены, comment-тред ✓, share-ссылки с паролем/TTL/embed ✓, snapshots с diff ✓ |
| **F-400…F-410 Экспорт** | Markdown, JSON, Mermaid — ✓. PNG/SVG — через ReactFlow на клиенте (заложено). PDF — отдельный Playwright воркер (Dockerfile.pdf, profile `pdf`). PPTX/GIF — v1.5 |
| **F-500…F-508 API** | tRPC v11 базис ✓, REST/OpenAPI/Webhooks/CLI — заложены контракты (`WebhookService`, `WebhookEndpoint` модель) |
| **§5 Хоткеи** | Все хоткеи описаны в `src/lib/hotkeys.ts`, реализованы основные (1/2/3/M/F/0/Tab/E/Esc/Cmd+K) |
| **§6 Архитектура** | Next.js 15 + tRPC + Hocuspocus + BullMQ + Prisma + pgvector ✓ |
| **§7 Безопасность** | BYOK AES-256-GCM ✓, headers ✓, rate limit ✓, audit log модель ✓, OWASP-патерны соблюдены |
| **§8 Offline-first** | Yjs + IndexedDB scaffold ✓, conflict resolution policy документирована |
| **§9 Mobile** | Responsive breakpoints в Tailwind, читалка через share-page, full mobile UI — v1.5 |
| **§10 UX** | Onboarding flow (Quick Capture как entry funnel), Empty/Error/Loading states, Key Setup Wizard ✓ |
| **§11 NFR** | `/api/health`, Docker размеры ✓, prefers-reduced-motion ✓, RU+EN ✓ |
| **§12 Growth** | Quick Capture без регистрации ✓, public Explore ✓, "Made with Sai" footer на share-страницах ✓ |

## Что НЕ сделано

Запланировано в следующих минорных версиях / спринтах:

- Полноценный **Workbox** offline-кеш (только заглушка SW).
- **Yjs → Structured layer sync** (каждые 30 сек) — заложен `YjsDocument` BLOB, но обратный sync в реляционные таблицы делается через canvas-mutations, не из Y.Doc.
- **Drag-and-drop** узлов в Global Chat (F-253).
- **Time Travel** анимация (F-215) — снапшоты сохраняются, UI плеера — TODO.
- **AI Bridge Suggestions** preview UI (data path готов в `MutationService.bridgeSuggest`).
- **Refactor preview** UI (data path готов).
- **PPTX Pitch Deck Export** (F-407) — слот в типах есть.
- **2FA / SAML / Obsidian Sync / sai-cli** — модели в схеме, реализация позже.
- **Public REST API + OpenAPI Swagger** — tRPC роутеры готовы, нужно прогнать через `trpc-to-openapi`.

Эти решения соответствуют дорожной карте ТЗ §13 (v1.0 → v1.5 → v2.0).

---

> Made with Sai · LGPL · 2026
