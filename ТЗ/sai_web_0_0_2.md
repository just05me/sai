# SAI WEB — Техническое задание v1.0

> **Версия:** 1.0.0 · **Дата:** 2026-06-13 · **Статус:** Готово к разработке  
> **Основа:** `concept.md`, `sai_business_logic.md`, `sai_0_0_5.md`, `sai_web.md` + продуктовый аудит

---

## Содержание

1. [Введение и контекст](#1-введение-и-контекст)
2. [Бизнес-логика и монетизация](#2-бизнес-логика-и-монетизация)
3. [Логика продукта](#3-логика-продукта)
4. [Функциональные требования](#4-функциональные-требования)
5. [Хоткеи](#5-справочник-хоткеев)
6. [Архитектура системы](#6-архитектура-системы)
7. [Безопасность](#7-безопасность)
8. [Offline-first и коллаборация](#8-offline-first-и-коллаборация)
9. [Мобильная стратегия](#9-мобильная-стратегия)
10. [UX-требования](#10-ux-требования)
11. [Нефункциональные требования](#11-нефункциональные-требования)
12. [Growth и GTM](#12-growth-и-gtm)
13. [Дорожная карта](#13-дорожная-карта)
14. [Глоссарий](#14-глоссарий)

---

## 1. Введение и контекст

### 1.1. Что такое Sai Web

**Sai Web** — браузерная рабочая среда для структурирования идей, технических заданий и бизнес-моделей через три связанных дерева знаний с AI-ассистентом.

Продукт сочетает три мира в одном:

- **n8n** — полированный граф-канвас с zoom/pan, узлами-карточками, мини-картой, hotkeys и коллаборацией
- **NotebookLM** — автогенерируемая ментальная карта, где клик по узлу = углубление через AI
- **Sai Desktop** — трёхдеревная модель (Разработка / Функции / Бизнес) как три угла зрения на идею

**Ключевое архитектурное отличие от всех конкурентов:** три связанных дерева, где каждый узел имеет тройной контекст (технический, продуктовый, бизнесовый) + BYOK без наценки на токены.

### 1.2. Целевая аудитория

| Сегмент | Сценарий | Ключевая ценность |
|---|---|---|
| Соло-фаундер | Проверка идеи за 10 минут | Текст → карта → ТЗ без трения |
| Малая команда 2–5 | Совместный канвас | Real-time без конфликтов |
| Консультант / ментор | Шеринг клиенту без логина | Профессиональная подача |
| Self-host команда | Развёртывание на своей VPS | Полный контроль данных |
| Технический PM | Связь бизнес-требований и задач | Единый граф вместо 3 инструментов |

### 1.3. Конкурентное позиционирование

| Продукт | Их слабость | Наше преимущество |
|---|---|---|
| Notion AI | Нет граф-визуализации | Три связанных дерева + граф |
| Whimsical | Нет AI-мутаций | AI изменяет граф напрямую |
| Miro | Дорого, нет структуры | Структурированная модель данных |
| Obsidian + плагины | Высокий порог входа | Онбординг за 30 секунд |
| NotebookLM | Только чтение, нет редактирования | Полное редактирование + экспорт |

---

## 2. Бизнес-логика и монетизация

### 2.1. Два режима поставки

Единый Docker-образ, поведение определяется переменной окружения:

```
SAI_MODE=cloud    # SaaS, биллинг Stripe, облачное хранение
SAI_MODE=selfhost # Без биллинга, без жёстких лимитов
```

### 2.2. Планы и цены

| Параметр | Free | Pro $12/мес | Team $29/мес | Self-Host Pro $49/мес |
|---|---|---|---|---|
| Проектов | 5 | Без лимита | Без лимита | Без лимита |
| Узлов на проект | 100 | 1 000 | Без лимита | Без лимита |
| BYOK (AI-ключи) | ✓ | ✓ | ✓ | ✓ |
| Mind Map генерация | ✓ | ✓ | ✓ | ✓ |
| Quick Capture | ✓ анонимно | ✓ | ✓ | ✓ |
| Idea Score | — | ✓ | ✓ | ✓ |
| Pitch Deck Export | — | ✓ | ✓ | ✓ |
| AI Personas | — | ✓ | ✓ | ✓ |
| Hypothesis Tracker | — | ✓ | ✓ | ✓ |
| Time Travel (GIF/MP4) | — | ✓ | ✓ | ✓ |
| Snapshots + diff | — | ✓ | ✓ | ✓ |
| Real-time коллаборация | — | — | ✓ до 20 чел. | ✓ |
| Team AI Memory (RAG) | — | — | ✓ | ✓ |
| SAML/SSO | — | — | ✓ | ✓ |
| SLA / приоритетная поддержка | — | — | 99.5% | ✓ |

**Принцип монетизации:** платить за AI-суперсилы, а не за хранение. Free план полностью функционален для соло — нет стимула уходить к конкурентам.

### 2.3. Иерархия данных

```
Account (User)
 └── Workspace (Personal | Team)
      ├── Members + Roles (Owner / Admin / Editor / Commenter / Viewer)
      ├── BYOK Keys (зашифрованные, AES-256-GCM)
      ├── API Tokens (scope: read / write / admin)
      ├── Projects
      │    ├── Tree: Разработка
      │    ├── Tree: Функции
      │    ├── Tree: Бизнес
      │    ├── CrossTreeEdges (мосты между деревьями)
      │    ├── Chats (Node Chat + Global Chat)
      │    ├── Snapshots
      │    └── Templates
      └── Billing (Stripe)
```

### 2.4. Limit Gate UX

Поведение при достижении лимитов Free-плана:

- **80% лимита** — soft warning banner в шапке проекта
- **100% лимита** — read-only режим. Существующие узлы видны, редактирование заблокировано
- **Upsell** — inline карточка внутри канваса (никаких pop-up блокировок)
- **Экспорт** — всегда доступен на любом плане (принцип доверия)
- **Удаление данных** — никогда автоматически. Данные хранятся 90 дней после отмены подписки

### 2.5. North Star Metric и KPI

| Метрика | Целевое значение |
|---|---|
| **North Star** | Проекты с >10 узлами + хотя бы 1 AI-действием за последние 7 дней |
| Activation event | Пользователь применил первую AI-мутацию |
| Time to Value | ≤3 минуты от регистрации до первой AI-мутации |
| D1 Retention | >60% |
| D7 Retention | >40% |
| D30 Retention | >25% |
| MRR target (3 мес) | $5 000+ |

---

## 3. Логика продукта

### 3.1. Три дерева — ядро модели

Каждый проект содержит ровно три дерева. Это не разделы — это три ментальные модели одной идеи:

| Дерево | Хоткей | Назначение | Типовые узлы |
|---|---|---|---|
| **Разработка** | `1` | Технические задачи, архитектура | API, БД, компоненты, сервисы |
| **Функции** | `2` | Пользовательские фичи, UX | Экраны, флоу, состояния, события |
| **Бизнес** | `3` | Монетизация, аудитория, метрики | Сегменты, каналы, юнит-экономика |

Деревья связаны **CrossTreeEdge** — мостами между узлами разных деревьев. Мосты визуально отличаются от внутренних рёбер (пунктирная линия с цветовым кодированием по дереву-источнику).

**Синхронизация:** кнопка "Синхронизировать" запускает диалог ревью каскадных изменений. Пользователь выбирает какие изменения принять. Лимит каскада — 20 узлов за операцию.

### 3.2. Граф = единая модель, два layout

Ментальная карта — **не отдельная сущность**, а второй layout того же графа:

- **Tree View** — структурное дерево (классический Sai). Хоткей `M` для переключения.
- **Mind Map View** — Radial / Hierarchical / Force-directed / Free раскладка

При переключении данные не меняются — меняется только движок отрисовки.

### 3.3. Схема данных узла

```json
{
  "id": "uuid-v4",
  "title": "string (max 200)",
  "description": "rich text (TipTap, markdown-compatible)",
  "tags": ["string", "..."],
  "status": "idea | in_progress | done | blocked",
  "assigneeId": "userId | null",
  "origin": {
    "type": "manual | ai_generate | ai_expand | ai_deepen | template | import",
    "prompt_hash": "string",
    "parent_chat_id": "string",
    "created_at": "ISO 8601"
  },
  "history": [
    { "source": "user | ai | import", "timestamp": "ISO 8601", "diff": {} }
  ],
  "hypothesisStatus": "none | untested | testing | validated | invalidated",
  "healthScore": "0–100 (computed)",
  "decisionLog": [
    { "summary": "string", "created_at": "ISO 8601", "ai_model": "string" }
  ]
}
```

### 3.4. AI-действия на узле

Все мутации проходят через **подтверждение**. AI никогда не изменяет граф без явного Accept пользователя.

| Действие | Хоткей | Что делает | Подтверждение |
|---|---|---|---|
| **Expand** | `E` | AI генерирует ≈4 дочерних узла | Accept all / Accept selected / Skip |
| **Deepen** | `D` | Открывает Node Chat с контекстом ветки + decision log | Только диалог, без авто-мутаций |
| **Refactor** | `R` | AI предлагает разделить / объединить / переименовать | Preview diff → Apply / Skip / Stop |
| **Bridge Suggest** | `B` | AI предлагает CrossTreeEdge к другим деревьям | Accept bridge / Dismiss |
| **Score Node** | — | AI оценивает качество описания, предлагает улучшения | Replace / Append / Skip |

### 3.5. Quick Capture Mode

Режим быстрого захвата идеи. Доступен **без регистрации** (анонимная сессия 24 часа).

1. Пользователь открывает `/capture` или нажимает «Попробовать» на лендинге
2. Вводит идею одной фразой (max 500 символов)
3. AI за ≤15 секунд генерирует skeleton: 3 узла на каждое дерево (9 итого)
4. Пользователь взаимодействует с картой без регистрации
5. При попытке сохранить — предложение регистрации. Данные сессии сохраняются автоматически

> **Зачем:** Quick Capture — главный acquisition funnel. Конверсия: посетитель → попробовал → зарегистрировался.

### 3.6. Idea Score

Доступен после заполнения ≥30% узлов проекта. Только Pro+.

AI анализирует все три дерева и возвращает:

- **Техническая реализуемость** — 0–100, список технических рисков
- **Рыночный потенциал** — 0–100, анализ аудитории и конкурентов из контекста узлов
- **Полнота описания** — 0–100, какие ветки требуют доработки
- **Слепые пятна** — список вопросов, на которые нет ответа в текущих деревьях

Результат экспортируется как PDF-отчёт или PNG-карточка для соцсетей.

### 3.7. Hypothesis Tracker

Узлы с `hypothesisStatus != none` появляются в отдельном sidebar-трекере.

Жизненный цикл: `Untested → Testing → Validated | Invalidated`

При смене статуса — обязательный промпт «что узнали». Заметка добавляется в `decisionLog` узла и автоматически передаётся в контекст при последующих AI-запросах.

### 3.8. AI Personas

В Global Chat — выбор системного промпта через персону:

| Персона | Фокус |
|---|---|
| **Investor** | Unit economics, TAM, payback period, burn rate |
| **Devil's Advocate** | Слабые места, неудобные вопросы |
| **Customer** | Боли целевой аудитории, jobs-to-be-done |
| **Architect** | Техническая реализация, масштабируемость |
| **Mentor** | Баланс поддержки и критики, открытые вопросы |

### 3.9. Режимы чата

| Тип | Контекст | Режим |
|---|---|---|
| **Node Chat** | Путь от корня + соседние узлы + decision log | Агент (мутации) или Вопросы |
| **Global Chat** | Весь проект. Drag-and-drop узлов в чат | Агент (мутации) или Вопросы |

- **Streaming** через SSE. Кнопка `Stop` останавливает генерацию. Частичный ответ сохраняется
- **Provider Quick Switcher** — смена LLM-провайдера прямо в интерфейсе чата
- **Attachments** — PDF / MD / TXT / изображения drag-and-drop в чат

---

## 4. Функциональные требования

> **Приоритеты:** MUST — обязательно для запуска · SHOULD — важно, делаем в первую очередь после MUST · COULD — желательно

### 4.1. Аутентификация и аккаунты (F-100…F-110)

| ID | Требование | Приоритет | План |
|---|---|---|---|
| F-100 | Регистрация через email + magic link (без пароля) | MUST | Free |
| F-101 | OAuth через Google и GitHub | MUST | Free |
| F-102 | SAML/SSO интеграция (корпоративная) | MUST | Team |
| F-103 | 2FA через TOTP (Google Authenticator совместимый) | MUST | Pro+ |
| F-104 | GDPR: экспорт всех данных пользователя в JSON | MUST | Free |
| F-105 | GDPR: полное удаление аккаунта в течение 30 дней | MUST | Free |
| F-106 | Профиль: аватар, имя, bio, часовой пояс, язык RU/EN | MUST | Free |
| F-107 | Onboarding flow: интерактивный туториал 3 шага с заполненным примером | MUST | Free |
| F-108 | Key Setup Wizard: пошаговая настройка BYOK при первом AI-действии | MUST | Free |
| F-109 | Session management: список сессий, revoke по одной или все | SHOULD | Free |
| F-110 | Анонимная сессия Quick Capture: 24 часа, конвертация при регистрации | MUST | Free |

### 4.2. Workspaces и проекты (F-120…F-135)

| ID | Требование | Приоритет | План |
|---|---|---|---|
| F-120 | Personal Workspace: создаётся автоматически при регистрации | MUST | Free |
| F-121 | Team Workspace: создание, переименование, удаление, аватар | MUST | Team |
| F-122 | Приглашение участников: email / ссылка. Роли Owner/Admin/Editor/Commenter/Viewer | MUST | Team |
| F-123 | Создание проекта: Blank / From idea / From file / From URL / From template | MUST | Free |
| F-124 | Импорт/экспорт `.sai` файлов с lossless совместимостью (Desktop v0.0.4+) | MUST | Free |
| F-125 | Архивирование проектов: soft-delete на 30 дней, восстановление | MUST | Free |
| F-126 | Избранные проекты: pin в sidebar | SHOULD | Free |
| F-127 | Quick Capture Mode: анонимный → skeleton → опциональная регистрация | MUST | Free |
| F-128 | Дублирование проекта с сохранением структуры | SHOULD | Free |
| F-129 | Full-text search по узлам, комментариям внутри workspace | MUST | Free |
| F-130 | Semantic search через pgvector: «найди узлы похожие на…» | MUST | Pro+ |
| F-131 | Command palette Cmd+K: поиск + действия + быстрые команды | MUST | Free |
| F-132 | Limit Gate UX: 80% warning, 100% read-only + inline upsell | MUST | Free |
| F-133 | Project Health Dashboard: score 0–100% по заполненности узлов | SHOULD | Free |
| F-134 | Шаблоны: личные / workspace / публичные. Форк, рейтинг, импорт/экспорт `.sai-template` | MUST | Free |
| F-135 | Public Explore `/explore`: витрина публичных проектов, фильтры по теме, форк | SHOULD | Free |

### 4.3. Канвас и граф (F-200…F-225)

| ID | Требование | Приоритет |
|---|---|---|
| F-200 | Zoom/pan: колёсико, trackpad pinch, кнопки +/−, fit-to-screen `F` | MUST |
| F-201 | Создание узла: Tab / двойной клик / `+` на родителе / Enter в меню | MUST |
| F-202 | Drag-and-drop: переупорядочивание узлов, рёбра drag-from-handle (стиль n8n) | MUST |
| F-203 | Multi-select: drag-рамкой + Shift+click. Bulk-операции: Delete / Move / Tag / Status / Export | MUST |
| F-204 | Minimap: правый нижний угол, кликабельная, viewport-прямоугольник, toggle | MUST |
| F-205 | Sticky notes: цветные, markdown, привязка к узлу опциональна | SHOULD |
| F-206 | Mind Map View: хоткей `M`. Раскладки: Radial / Hierarchical / Force-directed / Free | MUST |
| F-207 | Focus Mode: хоткей `F` на узле. Скрыть всё кроме выбранного + прямые дочерние. Выход `Esc` | MUST |
| F-208 | Подсветка узлов без описания (inherited from Desktop F-021) | MUST |
| F-209 | Темы: Light / Dark / System | MUST |
| F-210 | CrossTreeEdge: пунктир с цветовым кодированием по дереву-источнику | MUST |
| F-211 | Типы рёбер: parent-child / depends-on / relates-to / bridge. Подписи рёбер | MUST |
| F-212 | Quick-add меню: двойной клик по пустому канвасу → New node / Sticky / Bridge / Paste | MUST |
| F-213 | Inline-редактирование заголовка (double-click). Детальный редактор в правой панели | MUST |
| F-214 | TipTap редактор: markdown + rich text (bold, italic, code, tables, lists, links) | MUST |
| F-215 | Time Travel: анимация истории снапшотов. Экспорт GIF/MP4 | MUST · Pro+ |
| F-216 | Node Health Badge: визуальный индикатор заполненности на узле | SHOULD |
| F-217 | Generate Mind Map из: идеи / файла (.md/.pdf/.txt) / URL / голоса (Whisper) | MUST |
| F-218 | Mind Map параметры: max_depth, branching_factor, language из workspace settings | SHOULD |
| F-219 | Анимация фокуса при клике на узел ≤600 мс, поиск с центровкой камеры | MUST |
| F-220 | Настраиваемые хоткеи через Settings | SHOULD |
| F-221 | Hypothesis Tracker в sidebar: список, смена статуса, заметки | MUST · Pro+ |
| F-222 | Idea Score: кнопка при ≥30% заполнения. Три измерения + слепые пятна + экспорт | MUST · Pro+ |
| F-223 | AI Personas в Global Chat: Investor / Devil's Advocate / Customer / Architect / Mentor | MUST · Pro+ |
| F-224 | Smart Bridge Suggestions: AI предлагает CrossTreeEdge после Expand | SHOULD · Pro+ |
| F-225 | AI Context Memory: decision log накапливается и передаётся в последующие AI-запросы | MUST · Pro+ |

### 4.4. Коллаборация (F-300…F-311)

| ID | Требование | Приоритет | План |
|---|---|---|---|
| F-300 | Real-time co-editing на Yjs CRDT через Hocuspocus | MUST | Team |
| F-301 | Видимые курсоры с именем и цветом. Presence-аватары в шапке | MUST | Team |
| F-302 | Optimistic UI с откатом при конфликтах. Merge без блокировок | MUST | Team |
| F-303 | Комментарии на узле / ребре / sticky: тред с @mention, resolve, reply | MUST | Team |
| F-304 | Шеринг по ссылке: View / Comment / Edit. Пароль. TTL (7/30/∞ дней) | MUST | Free |
| F-305 | Публичный read-only режим без логина. Embed в iframe | MUST | Free |
| F-306 | Auto-snapshots каждые 50 изменений + именованные ручные | MUST | Pro+ |
| F-307 | Diff между snapshot. Восстановление создаёт новую ветку | MUST | Pro+ |
| F-308 | In-app уведомления: @mention, комментарий, изменение статуса, приглашение | MUST | Free |
| F-309 | Email уведомления: immediate для @mention, daily digest для остального | MUST | Free |
| F-310 | Настройки уведомлений: per-project granularity | SHOULD | Free |
| F-311 | Team AI Memory (RAG): pgvector хранит контекст команды, используется в AI-запросах | MUST | Team |

### 4.5. Экспорт (F-400…F-410)

| ID | Требование | Приоритет | План |
|---|---|---|---|
| F-400 | Markdown: каждый узел = раздел, иерархия сохраняется | MUST | Free |
| F-401 | JSON: нативный формат, совместим с API | MUST | Free |
| F-402 | PNG / SVG: текущий viewport или весь граф | MUST | Free |
| F-403 | PDF: через Playwright (отдельный Docker-сервис, опциональный) | MUST | Free |
| F-404 | Mermaid: три отдельных flowchart, CrossTreeEdge как subgraph link с preview | SHOULD | Free |
| F-405 | PlantUML: package per tree | COULD | Free |
| F-406 | Публикация как статической HTML-страницы: уникальный URL | SHOULD | Pro+ |
| F-407 | Pitch Deck Export: AI генерирует 10-слайдовый PPTX по трём деревьям. Стили: minimal / corporate / startup | MUST | Pro+ |
| F-408 | Idea Score Export: PDF-отчёт и PNG-карточка для соцсетей | SHOULD | Pro+ |
| F-409 | Time Travel Export: GIF или MP4 | SHOULD | Pro+ |
| F-410 | Диалог экспорта: выбор деревьев, выбор узлов (все / выделенные), format, preview | MUST | Free |

### 4.6. Public API и интеграции (F-500…F-508)

| ID | Требование | Приоритет | План |
|---|---|---|---|
| F-500 | REST API поверх tRPC. OpenAPI схема + Swagger UI на `/api/docs` | MUST | Pro+ |
| F-501 | API-токены workspace-уровня: создание, revocation, scope (read/write/admin) | MUST | Pro+ |
| F-502 | Rate limiting: 100 req/min Free, 1 000 Pro, custom Team. Заголовки `X-RateLimit-*` | MUST | All |
| F-503 | Webhooks: `project.created`, `node.changed`, `sync.completed`, `mind_map.generated`, `comment.created` | MUST | Pro+ |
| F-504 | Webhook signature: HMAC-SHA256 в заголовке `X-Sai-Signature` | MUST | Pro+ |
| F-505 | Audit log API-запросов: последние 100, endpoint, timestamp, IP | MUST | Team |
| F-506 | Интеграции: Zapier / n8n / Make через REST API | SHOULD | Pro+ |
| F-507 | Obsidian Sync: импорт vault, двусторонняя синхронизация через webhook | SHOULD | Pro+ |
| F-508 | `sai-cli` v1: `login` / `pull` / `push` / `export --format=md\|json\|pptx` | SHOULD | Pro+ |

---

## 5. Справочник хоткеев

| Хоткей | Действие | Контекст |
|---|---|---|
| `Cmd/Ctrl + K` | Global Chat / Command palette | Везде |
| `Tab` | Создать дочерний узел | Узел выбран |
| `Enter` | Создать узел-сосед | Узел выбран |
| `Delete` / `Backspace` | Удалить узел / ребро | Выделен |
| `Space` | Pan-режим | Канвас |
| `1` / `2` / `3` | Переключить дерево | Везде |
| `M` | Tree View ↔ Mind Map View | Везде |
| `F` | Fit-to-screen / Focus Mode (на узле) | Пусто / Узел |
| `0` | Сброс зума к 100% | Канвас |
| `/` | Поиск по узлам | Везде |
| `E` | Expand — AI генерирует дочерние узлы | Узел выбран |
| `D` | Deepen — открыть Node Chat | Узел выбран |
| `R` | Refactor — AI предлагает реструктуризацию | Узел выбран |
| `B` | Bridge Suggest — AI предлагает CrossTreeEdge | Узел выбран |
| `Cmd/Ctrl + Z` | Undo (через Yjs history) | Везде |
| `Cmd/Ctrl + Shift + Z` | Redo | Везде |
| `Cmd/Ctrl + A` | Выбрать все узлы | Канвас |
| `Esc` | Снять выделение / Закрыть / Выйти из Focus | Везде |
| `?` | Справка по хоткеям | Везде |

> Все хоткеи переназначаются пользователем через Settings → Keyboard Shortcuts.

---

## 6. Архитектура системы

### 6.1. Стек технологий

#### Frontend

| Технология | Версия | Назначение |
|---|---|---|
| Next.js | 15 (App Router) | SSR/SSG, маршрутизация, API routes |
| React | 19 | UI компоненты |
| TypeScript | 5.x | Типизация |
| Tailwind CSS | 4.x | Стили |
| shadcn/ui | latest | UI-компоненты |
| **Yjs** | 13.x | CRDT для коллаборации |
| **React Flow** | 12.x | Граф-канвас (Tree View и Mind Map) |
| Zustand | 4.x | Глобальный стейт |
| TanStack Query | 5.x | Server state, кеширование |
| tRPC | 11.x | Type-safe API клиент |
| Auth.js | v5 | Аутентификация, OAuth |
| TipTap | 2.x | Rich-text редактор |
| next-intl | 3.x | i18n RU/EN |
| Workbox + IndexedDB | 7.x | Service Worker, offline-кеш |

> **Примечание по рендеру:** React Flow 12 используется для обоих видов (Tree View и Mind Map) с виртуализацией. PixiJS/WebGL не используется в v1–v2. Cytoscape.js рассматривается в v2.5 только при профилировании >1 000 узлов на основе реальных данных.

#### Backend

| Технология | Версия | Назначение |
|---|---|---|
| Node.js | 22 LTS | Runtime |
| **Next.js Route Handlers** | 15 | Единственный API layer для v1–v2 |
| **Hocuspocus** | 2.x | CRDT-сервер для Yjs, WebSocket |
| `@hocuspocus/extension-database` | latest | Yjs persistence → PostgreSQL BLOB |
| Prisma | 5.x | ORM, миграции |
| BullMQ | 5.x | Очереди: AI-запросы, экспорт, email, webhooks |
| Vercel AI SDK | 3.x | Провайдер-агностик LLM, streaming |
| Playwright | 1.x | PDF-экспорт (отдельный Docker-сервис) |

> **Примечание:** NestJS не используется в v1–v2. Рассматривается в v2.5+ как отдельная микросервисная граница для AI Orchestrator, если Route Handlers покажут ограничения при профилировании. Решение принимается на основе данных, а не заранее.

#### База данных и хранилище

| Технология | Назначение |
|---|---|
| PostgreSQL 16 | Реляционные данные + JSONB + pgvector + FTS |
| pgvector | Semantic search, Team AI Memory (RAG) |
| Redis 7 | BullMQ, кеш сессий, rate limiting |
| S3-совместимое | Cloud: R2/S3. Self-host: MinIO |

### 6.2. Потоки данных

```
Browser (React + Yjs + IndexedDB + SW)
    │ HTTPS/tRPC       │ WSS/Yjs          │ SSE/AI Streaming
    ▼                  ▼                  ▼
API Routes         Hocuspocus         AI Orchestrator
(Next.js)          CRDT-сервер        (Vercel AI SDK)
    │                  │                  │
    ▼                  ▼                  ▼
Domain Services (TypeScript monorepo):
  SyncService | BridgeService | MutationService
  MindMapService | ChatService | ProviderManager
  UsageTracker | HistoryService | SnapshotService
  CollaborationService | ExportService | ShareService
  BillingService | WebhookService | AuthService
  AIMemoryService | NotificationService
    │                  │                  │
    ▼                  ▼                  ▼
PostgreSQL + pgvector   Redis + BullMQ   S3 (MinIO/R2)
                                          │
                                          ▼
                              External LLM (OpenAI/Anthropic/…)
```

### 6.3. Domain Services

| Сервис | Ответственность |
|---|---|
| `SyncService` | Синхронизация трёх деревьев, разрешение конфликтов, каскады |
| `BridgeService` | CrossTreeEdge, AI Bridge Suggestions |
| `MutationService` | Expand, Refactor, Score Node. Подтверждение через preview |
| `MindMapService` | Генерация карты, layout-алгоритмы, JSON-схема валидация, ретраи |
| `ChatService` | Node/Global Chat, история, streaming, AI Personas |
| `ProviderManager` | BYOK: ключи, маршрутизация к LLM, fallback |
| `UsageTracker` | Токены, запросы, стоимость. Предупреждения при достижении лимитов |
| `HistoryService` | Decision log, история изменений, Time Travel |
| `SnapshotService` | Авто и ручные снапшоты, diff, восстановление ветками |
| `CollaborationService` | Presence, курсоры, комментарии |
| `NotificationService` | In-app уведомления, email digest через BullMQ |
| `ExportService` | MD / JSON / PNG / SVG / PDF / Mermaid / PPTX / GIF |
| `ShareService` | Ссылки, пароли, TTL, права доступа |
| `BillingService` | Stripe, план пользователя, лимиты |
| `WebhookService` | Delivery с HMAC подписью, retry, audit log |
| `AuthService` | Magic link, OAuth, 2FA, SAML, сессии |
| `AIMemoryService` | Decision log + pgvector RAG для Team AI Memory |

### 6.4. Docker Compose (self-host)

```yaml
services:
  sai-app:          # Next.js + Hocuspocus + Prisma. Размер ≤500 МБ
  sai-worker:       # BullMQ workers (AI, email, webhooks)
  postgres:         # PostgreSQL 16 с pgvector
  redis:            # Redis 7
  minio:            # S3-совместимое хранилище

  # Опциональные профили:
  sai-pdf-worker:   # profiles: [pdf]. Playwright + Chromium ~600 МБ
  prometheus:       # profiles: [monitoring]
  grafana:          # profiles: [monitoring]
```

---

## 7. Безопасность

### 7.1. BYOK — модель с нулевым знанием сервера

```
Пользователь вводит ключ в браузере
    │
    ▼ Web Crypto API
Шифрование AES-256-GCM
Master-key = PBKDF2(user_id + server_secret)
    │
    ▼ HTTPS
Зашифрованный BLOB → PostgreSQL (поле encrypted_key BYTEA)
    │
    ▼ При AI-запросе
Расшифровка в памяти Node.js процесса
Ключ используется → не логируется → не кешируется
```

**Гарантия:** даже при компрометации PostgreSQL — открытые ключи не раскрываются.

### 7.2. Общие требования

| Область | Требование |
|---|---|
| Транспорт | TLS 1.3 обязателен для всех соединений |
| CSP | Строгий Content-Security-Policy, nonce для inline scripts |
| CORS | Whitelist по доменам, preflight validation |
| SQL Injection | Устраняется через Prisma parameterized queries |
| XSS | TipTap sanitization + DOMPurify для пользовательского HTML |
| CSRF | SameSite=Strict cookies + double-submit pattern |
| Rate Limiting | Redis-based: 5 req/min для auth endpoints, per-user для API |
| Secrets | Только env-переменные. Нет хардкода. Vault для Cloud |
| Audit Log | Все чувствительные действия: login, key-create, delete — с IP и timestamp |
| OWASP Top 10 | Следование рекомендациям для всех API endpoints |
| Pentest | Внешний аудит безопасности перед публичным запуском |

---

## 8. Offline-first и коллаборация

### 8.1. Offline стратегия

- **Service Worker (Workbox)** кеширует последний Yjs бинарный snapshot в IndexedDB
- При отключении — пользователь продолжает работать. Изменения накапливаются локально
- При reconnect — автоматический Yjs merge. Toast «X изменений синхронизировано»
- **Tombstone UI** — если проект удалён пока offline: карточка с возможностью восстановления
- **IndexedDB TTL** — кеш хранится 30 дней, затем предупреждение перед очисткой

### 8.2. Yjs Persistence Architecture

Два независимых слоя хранения:

**Operational Layer (Yjs + Hocuspocus)**
- In-memory CRDT на сервере
- `@hocuspocus/extension-database` сохраняет Yjs BLOB в таблицу `yjs_documents` PostgreSQL
- RPO при сбое сервера: 0 если BLOB успел сохраниться

**Structured Layer (PostgreSQL)**
- Source of truth для API, поиска, экспорта, RAG
- Yjs-to-structured sync каждые 30 секунд или при idle пользователя
- Обновляет реляционные таблицы `nodes`, `edges`, `trees`

### 8.3. Conflict Resolution Policy

| Тип конфликта | Политика |
|---|---|
| Внутри одного дерева | Yjs CRDT: merge без конфликтов (Last-Write-Wins с vector clock) |
| CrossTree Sync | Пользовательское подтверждение. Preview diff, Accept/Reject per change. Лимит 20 узлов |
| Snapshot Restore | Создаёт новую ветку, не перезаписывает текущее состояние |
| Offline merge | Yjs автоматически. Toast с результатом |

---

## 9. Мобильная стратегия

Полный граф-канвас — только desktop. Mobile строится итеративно:

| Версия | Функционал | Реализация |
|---|---|---|
| v1.0 | Read-only viewer + комментарии | Адаптивная верстка, touch-scroll |
| v1.5 | Добавление узла / переименование. Global Chat | Drawer UI, bottom nav |
| v2.0 | Hypothesis Tracker. Quick Capture | PWA с offline |
| v2.5 | Базовое редактирование графа | Canvas touch gestures |

**Touch gestures:** pinch-to-zoom, long-press = контекстное меню, swipe между деревьями

**Bottom Navigation:** Разработка / Функции / Бизнес / Chat / Settings

**Responsive breakpoints:** 390px (mobile) · 768px (tablet, канвас доступен) · 1280px (desktop)

---

## 10. UX-требования

### 10.1. Onboarding Flow (обязателен)

Три шага при первом входе:

1. **Идея** — ввести идею одной фразой (max 500 символов) или выбрать тему из 5 подсказок
2. **Карта** — AI генерирует skeleton 9 узлов. Анимация «растущего дерева» ≤15 сек
3. **Туториал** — интерактивный обход: «Это дерево Разработки. Нажми `E` чтобы расширить первый узел»

Сэмпл-проект нельзя удалить первые 24 часа — гарантирует D1 retention.

### 10.2. Error States

Для каждого AI-действия — три обязательных состояния:

- **Loading** — skeleton-узлы с пульсацией. При >10 сек → «AI думает, это займёт немного больше времени...»
- **Success** — анимация появления узлов. Toast «4 узла добавлены — Accept All / Review»
- **Error** — конкретная причина (не «что-то пошло не так»):
  - «Ключ OpenAI недействителен → [Обновить ключ]»
  - «Превышен лимит токенов провайдера → [Сменить провайдер]»
  - «Провайдер временно недоступен → [Повторить]»

### 10.3. Empty States

| Состояние | CTA |
|---|---|
| Новый пустой проект | «Опиши идею одной фразой →» (запускает Quick Capture) |
| Пустой поиск | «Ничего не найдено по запросу X. Создать узел с таким именем?» |
| Пустой workspace | «Создай первый проект или попробуй шаблон» |
| Нет BYOK-ключа | «Добавь API-ключ чтобы использовать AI → [Настроить]» |

### 10.4. Notification System

- **In-app Bell** — sidebar с историей уведомлений. Badge counter. Toast для немедленных событий
- **Email** — immediate для @mention, daily digest в 09:00 часового пояса пользователя
- **Настройки** — per-project: все события / только @mention / выключено
- **Self-host SMTP** — если не настроен: email уведомления gracefully отключаются, in-app работают

### 10.5. Key Setup Wizard

При первом AI-действии без ключа — drawer с вариантами:

| Провайдер | Что показываем |
|---|---|
| OpenAI | Поле ввода + ссылка «Получить ключ» + кнопка «Проверить» |
| Anthropic | Поле ввода + ссылка «Получить ключ» + кнопка «Проверить» |
| OpenRouter | Поле ввода + список моделей + бесплатный tier |
| Ollama | Автоопределение на `localhost:11434` + ручной ввод адреса |

После добавления — ping-запрос для проверки валидности ключа.

---

## 11. Нефункциональные требования

### 11.1. Производительность

| Метрика | Цель | Условие |
|---|---|---|
| TTI (Time to Interactive) | ≤2.5 сек | 4G, пустой кеш |
| FCP (First Contentful Paint) | ≤1.5 сек | 4G, пустой кеш |
| Канвас FPS (≤500 узлов) | 60 fps | React Flow с виртуализацией |
| Канвас FPS (≤2000 узлов) | ≥30 fps | React Flow + fallback |
| Mind Map генерация (300 слов) | ≤20 сек | GPT-4o-mini |
| Quick Capture skeleton | ≤15 сек | 9 узлов |
| Expand узла | ≤10 сек | 4 дочерних узла |
| CRDT операция p95 | ≤100 мс | В регионе размещения |
| API Response p95 | ≤300 мс | Без AI-запросов |

### 11.2. Надёжность

| Метрика | Цель |
|---|---|
| SLA Cloud | 99.5% uptime |
| RPO | ≤5 минут |
| RTO | ≤1 час |
| Бэкапы PostgreSQL | Ежечасно (Point-in-Time Recovery), хранятся 30 дней |
| Health checks | `/api/health` с детальным статусом всех зависимостей |
| Graceful degradation | При недоступности LLM — AI-функции отключаются, остальное работает |

### 11.3. Масштабируемость

- **Self-host:** 1 VPS 4 CPU / 8 GB RAM → до 100 MAU
- **Cloud:** Kubernetes + Helm. Hocuspocus горизонтально масштабируется через Redis adapter
- **BullMQ workers:** масштабируются независимо от основного API
- **PostgreSQL:** read replicas для аналитики и семантического поиска

### 11.4. Docker-образы

| Образ | Содержимое | Размер | Запуск |
|---|---|---|---|
| `sai-app` | Next.js + Hocuspocus + Prisma | ≤500 МБ | Всегда |
| `sai-worker` | BullMQ workers | ≤300 МБ | Всегда |
| `sai-pdf-worker` | Playwright + Chromium | ~600 МБ | `profiles: [pdf]` |
| `sai-migration` | Prisma migrate | — | Одноразово при обновлении |

### 11.5. Доступность и локализация

- **WCAG 2.1 AA** — обязателен для всех ключевых флоу
- **Keyboard navigation** — полная навигация без мыши
- **Screen reader** — aria-labels на всех значимых элементах
- **Reduced motion** — `prefers-reduced-motion` уважается: анимации отключаются
- **Языки** — RU и EN при запуске. i18n-архитектура поддерживает добавление без рефакторинга

### 11.6. Self-hosted Operations

```bash
# Обновление
docker compose pull && docker compose up -d

# Миграции запускаются автоматически при старте sai-migration
# + предупреждение в логах о необходимости бэкапа перед major версиями
```

| Политика | Правило |
|---|---|
| Minor версии | Backward compatible, без breaking changes |
| Major версии | Migration guide обязателен, CHANGELOG с BREAKING CHANGES |
| CHANGELOG | Семантическое версионирование, каждый релиз |
| Мониторинг | Prometheus + Grafana в `docker-compose.yml` профиль `monitoring` |

---

## 12. Growth и GTM

### 12.1. Acquisition механизмы

- **Quick Capture без регистрации** — главный funnel. Посетитель → попробовал → зарегистрировался
- **Public Explore `/explore`** — органический SEO. Каждый публичный проект = индексируемая страница
- **20 premium шаблонов** при запуске с SEO-оптимизированными лендингами
- **Time Travel Export** — вирусный UGC: «Как росла моя идея за 2 недели» в Twitter/LinkedIn
- **Idea Score Share** — PNG-карточка результата для соцсетей
- **«Made with Sai»** — на всех публичных страницах и в экспортированных файлах

### 12.2. Launch последовательность

1. Early Access waitlist с referral механикой за 4 недели до запуска
2. Discord community открывается за 2 недели до запуска
3. **День запуска:** Product Hunt + Show HN + Indie Hackers пост одновременно
4. Партнёрские шаблоны с известными авторами контента

### 12.3. Referral программа

- **Пользователи:** +1 проект в лимите за каждого приглашённого (не деньги — более виральное)
- **Affiliate:** 30% recurring для creators (YouTube, Substack, Telegram)
- Интеграция через ReferralHero или self-built

### 12.4. Продуктовые метрики (PostHog)

| Категория | Метрики |
|---|---|
| Acquisition | Unique visitors, Quick Capture starts, registration rate |
| Activation | Time to first AI mutation, % users с >10 узлами в Day 1 |
| Retention | D1/D7/D30, WAU/MAU ratio |
| Revenue | MRR, ARPU, churn rate, expansion revenue |
| Virality | K-factor, share-link clicks, referral conversions |

---

## 13. Дорожная карта

### v1.0 — 0 → 3 месяца (Готовый продукт)

**Канвас и граф:**
Канвас + три дерева + Mind Map генерация + AI чат (Node + Global) + мутации (Expand/Deepen/Refactor) + CrossTreeEdge + Focus Mode + Sticky Notes + Minimap + Темы

**AI и продукт:**
Quick Capture (анонимно) + Onboarding flow + Key Setup Wizard + AI Context Memory + Provider Quick Switcher + Streaming + подтверждение мутаций

**Инфраструктура:**
Auth (email magic link + Google + GitHub) + BYOK с шифрованием + Yjs persistence в PostgreSQL + Docker Compose + Prisma + BullMQ

**Монетизация и рост:**
Stripe (Pro / Team) + Limit Gate UX + Шаблоны + Public Explore + Уведомления (in-app + email) + PostHog метрики

**Экспорт:**
Markdown + JSON + PNG + SVG + PDF (отдельный воркер) + Mermaid

**i18n:** RU + EN

---

### v1.5 — +2 месяца

Real-time коллаборация (Yjs + Hocuspocus) · Курсоры + Presence · Комментарии с @mention · Auto-snapshots + Diff + Restore · Idea Score · Smart Bridge Suggestions · Pitch Deck Export (PPTX) · Time Travel (GIF/MP4) · 2FA · Referral программа

---

### v2.0 — +2 месяца

Public API + OpenAPI + Webhooks · AI Personas · Hypothesis Tracker · SAML/SSO · Semantic search (pgvector) · Team AI Memory (RAG) · Obsidian Sync · `sai-cli` v1 · Node Health Dashboard · Mobile read-only viewer · Self-host upgrade guide + CHANGELOG

---

### v2.5 — +3 месяца

AI Debate Mode · Whisper.cpp локальный · WebGL рендер для >1 000 узлов (Cytoscape.js, если данные профилирования подтвердят необходимость) · Mobile базовое редактирование · `@sai/core` публичная библиотека · Enterprise self-host лицензия · Zapier/n8n/Make коннекторы · PlantUML export

---

## 14. Глоссарий

| Термин | Определение |
|---|---|
| **BYOK** | Bring Your Own Key — пользователь предоставляет собственный API-ключ LLM-провайдера |
| **CrossTreeEdge** | Ребро графа, связывающее узлы из разных деревьев |
| **CRDT** | Conflict-free Replicated Data Type — структура данных для безконфликтной коллаборации |
| **Decision Log** | Список AI-суммаризаций ключевых решений в контексте узла |
| **Expand** | AI-действие: генерация дочерних узлов |
| **Focus Mode** | Режим работы с одним узлом: скрыть всё кроме выбранного + дочерние |
| **Hypothesis Tracker** | Компонент отслеживания гипотез с жизненным циклом Untested → Validated/Invalidated |
| **Idea Score** | AI-оценка идеи по трём измерениям: техническая реализуемость, рыночный потенциал, полнота |
| **Mind Map View** | Второй layout того же графа: радиальная / иерархическая / force-directed раскладка |
| **Mutation** | Изменение графа, всегда требует подтверждения пользователя |
| **Quick Capture** | Режим захвата идеи без регистрации (анонимная сессия 24 часа) |
| **RAG** | Retrieval-Augmented Generation — AI использует pgvector для поиска релевантного контекста |
| **`.sai` файл** | Нативный формат Sai Desktop. Sai Web импортирует lossless для базовых полей |
| **Snapshot** | Именованная точка восстановления состояния проекта |
| **Time Travel** | Анимация истории проекта по timeline снапшотов, с экспортом GIF/MP4 |
| **Tree View** | Структурное дерево — классический режим отображения |

---

> *SAI WEB TZ v1.0.0 · 2026-06-13 · Конфиденциально*  
> *Основано на: `sai_web.md` v0.1.0 + продуктовый аудит*