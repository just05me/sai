# Sai Web — Техническое задание (web-версия продукта)

> **Статус:** Драфт для согласования и реализации
> **Версия документа:** sai_web v0.1.0
> **Дата:** 2026-06-13
> **Основание:** `ТЗ/concept.md`, `ТЗ/sai_business_logic.md`, `ТЗ/sai_0_0_5.md`, `ТЗ/sai_0_0_6.md`
> **Источники вдохновения:** [n8n](https://n8n.io) (канвас, узлы, шеринг, self-host), [NotebookLM Mind Map](https://notebooklm.google.com) (интерактивная ментальная карта с углублением по клику)
> **Тип документа:** Technical Specification (web-продукт)
> **Фокус:** перенос Sai в браузер, новая интерактивная ментальная карта, коллаборация, мультитенантность, BYOK, self-hosted + cloud SaaS

---

## Оглавление

1. [Цель web-версии](#1-цель-web-версии)
2. [Что берём у n8n и NotebookLM](#2-что-берём-у-n8n-и-notebooklm)
3. [Целевая аудитория и сценарии](#3-целевая-аудитория-и-сценарии)
4. [Архитектурные принципы](#4-архитектурные-принципы)
5. [Функциональные требования](#5-функциональные-требования)
6. [Ментальная карта (Mind Map Engine)](#6-ментальная-карта-mind-map-engine)
7. [Канвас и взаимодействие (n8n-style)](#7-канвас-и-взаимодействие-n8n-style)
8. [Коллаборация и шеринг](#8-коллаборация-и-шеринг)
9. [Мультитенантность, аккаунты, BYOK](#9-мультитенантность-аккаунты-byok)
10. [Нефункциональные требования](#10-нефункциональные-требования)
11. [UI/UX требования](#11-uiux-требования)
12. [Технический стек](#12-технический-стек)
13. [Архитектура системы](#13-архитектура-системы)
14. [Модель данных](#14-модель-данных)
15. [API и протоколы](#15-api-и-протоколы)
16. [Безопасность и приватность](#16-безопасность-и-приватность)
17. [Деплой: Cloud SaaS + Self-hosted](#17-деплой-cloud-saas--self-hosted)
18. [План реализации (MVP → v1 → v1.5)](#18-план-реализации-mvp--v1--v15)
19. [Критерии приёмки](#19-критерии-приёмки)
20. [Открытые вопросы и риски](#20-открытые-вопросы-и-риски)

---

## 1. Цель web-версии

`Sai Web` — браузерная реализация Sai, которая:

1. Переносит концепцию **трёх деревьев** (`Разработка`, `Функции`, `Бизнес`) и **ИИ-чатов узлов** из десктопа в web без потери идентичности продукта.
2. Поднимает планку UX канваса до уровня **n8n** (плавный zoom/pan, snap, мини-карта, multi-select, sticky notes, hotkeys, dark mode).
3. Добавляет **интерактивную ментальную карту** в духе **NotebookLM Mind Map**: автогенерируемая иерархия, где клик по узлу = углубление через ИИ.
4. Делает Sai **коллаборативным**: проекты можно расшаривать, редактировать вдвоём, оставлять комментарии.
5. Сохраняет принцип **BYOK** (Bring Your Own Key) и работу через ключи пользователя, чтобы остаться продуктом без принудительного облачного биллинга.
6. Поддерживает **self-hosted** деплой (Docker Compose, как n8n) и **Cloud SaaS** одинаково.

Ключевой пользовательский результат за один сеанс в web:
**загрузить идею (текст/файл/ссылку) → получить ментальную карту → нырнуть в любой узел через ИИ → синхронизировать с 3 деревьями → экспортировать или расшарить.**

---

## 2. Что берём у n8n и NotebookLM

### 2.1. От n8n (полированный канвас и web-инфраструктура)

| Элемент | Берём | Не берём |
|---------|-------|----------|
| Канвас с zoom/pan и smooth interactions | ✅ | — |
| Узлы как «карточки» с заголовком и значками | ✅ | — |
| Мини-карта в правом нижнем углу | ✅ | — |
| Multi-select, групповые операции, выделение рамкой | ✅ | — |
| Sticky notes на канвасе | ✅ | — |
| Hotkeys для всех частых операций | ✅ | — |
| Quick-add меню по двойному клику или `Tab` | ✅ | — |
| Версионирование (история ревизий проекта) | ✅ | — |
| Шеринг по ссылке (view/edit) | ✅ | — |
| Self-host через Docker | ✅ | — |
| Тэги и фильтры по проектам | ✅ | — |
| Light/Dark + системная тема | ✅ | — |
| Workflow execution / триггеры / webhooks | — | ✅ (это не наш домен) |
| Магазин коммьюнити-нод | — | ✅ (у нас шаблоны проектов, не ноды) |

### 2.2. От NotebookLM Mind Map (интерактивное углубление)

| Элемент | Берём | Адаптация для Sai |
|---------|-------|-------------------|
| Автогенерация ментальной карты из источника | ✅ | Источник = текст идеи, URL, файл, голос |
| Hierarchical layout (центр → ветви → листья) | ✅ | Альтернатива дереву, переключается в один клик |
| Клик по узлу → раскрытие подтем через ИИ | ✅ | Узел разворачивается на N подузлов (`Expand`) |
| Клик по узлу → контекстный чат по теме | ✅ | Открывает `Node Chat` уже знакомый по десктопу |
| Анимированные переходы и фокус на ветке | ✅ | Камера плавно центрируется на выбранном узле |
| Источники-цитаты на каждом узле | ✅ | Узел знает откуда он (idea/AI/manual/template) |
| Pan/zoom как в Google Maps | ✅ | Поддержка трекпада и тачскрина |
| Read-only «карта знаний» | — | У нас карта всегда редактируема (это не reference doc) |

### 2.3. Гибрид

Sai Web = **рабочий канвас n8n** + **исследовательская ментальная карта NotebookLM** + **3-tree бизнес-логика Sai**.

Канвас имеет два режима отображения одного и того же графа:
- **Tree View** — текущий вид Sai (структурное дерево с явными связями).
- **Mind Map View** — радиальная/иерархическая раскладка с фокусом на «explore by clicking».

Переключение режимов — горячая клавиша `M`, состояние графа не меняется.

---

## 3. Целевая аудитория и сценарии

### 3.1. Аудитория

Та же, что в десктопе (`concept.md`), плюс web-специфичные:

- **Соло-фаундеры** — хотят валидировать идею в браузере без установки.
- **Вайбкодеры** — открывают на ноуте/айпаде в кафе.
- **Малые команды** (2–5 человек) — нужен совместный канвас.
- **Преподаватели/наставники** — расшаривают карту студентам в `view-only`.
- **Консультанты** — приносят клиенту ссылку на ментальную карту проекта.

### 3.2. Ключевые сценарии (user journeys)

#### JTBD-1. «Я хочу проверить идею за 10 минут»
1. Открываю sai.app, регистрируюсь (Google/Email).
2. Жму `New project → From idea`, вставляю 2–3 абзаца текста.
3. Жду 10–20 сек → получаю готовую ментальную карту (узлы + связи).
4. Кликаю на интересный узел → открывается чат `Раскрыть подтемы`.
5. Принимаю предложенные узлы → дерево растёт.
6. Экспортирую в Markdown.

#### JTBD-2. «Я хочу провести воркшоп с командой»
1. Открываю существующий проект.
2. Жму `Share → Invite by email` или копирую ссылку с правами `Editor`.
3. Команда открывает ссылку, видит мои курсоры, оставляет комментарии на узлах.
4. Кто-то правит описание узла → у меня моментально обновляется (CRDT/OT).
5. После сессии — `Snapshot` фиксирует ревизию.

#### JTBD-3. «Я хочу превратить ментальную карту в ТЗ»
1. Прорабатываю дерево `Функции` через Mind Map View.
2. Запускаю синхронизацию трёх деревьев (как в `v0.0.6`).
3. Подтверждаю каскадные изменения в `Разработке` и `Бизнесе`.
4. Открываю `Export → PDF`, выбираю набор узлов и деревьев.
5. Получаю готовый документ.

#### JTBD-4. «Я self-host для своей команды»
1. `docker compose up` на VPS.
2. Захожу на `https://sai.mycompany.com`, создаю первого admin.
3. Подключаю свои API-ключи (OpenAI/Anthropic/OpenRouter) на уровне workspace.
4. Приглашаю команду.

---

## 4. Архитектурные принципы

| Принцип | Описание |
|---------|----------|
| **Web-first, не порт** | Не пытаемся 1-в-1 повторить десктоп. Используем сильные стороны web (URL-навигация, шеринг, real-time). |
| **Local-first где можно** | Кэшируем проект в IndexedDB, поддерживаем offline-просмотр и оптимистичные мутации. |
| **CRDT для коллаборации** | Yjs (или эквивалент) как single source of truth для графа в браузере. |
| **API-first** | Любая UI-функция доступна и через HTTP API. UI — первый клиент собственного API. |
| **BYOK по умолчанию** | API-ключи ИИ принадлежат пользователю/workspace. SaaS не берёт наценку на токены (только подписка за фичи коллаборации). |
| **Single artefact** | Тот же docker-образ работает и в SaaS, и в self-host. Различия — конфиг. |
| **Schema-versioned data** | Все сущности имеют `schema_version`, мигратор поддерживает откат и upgrade. |
| **Privacy-respecting AI** | Запросы к LLM идут через пользовательский ключ напрямую (если возможно) или через прозрачный прокси с логированием только метаданных. |
| **Progressive enhancement** | Базовые операции работают без JS-движка карты (fallback на список). |
| **Не блокируем экспорт** | Экспорт работает офлайн в браузере, без серверной зависимости где возможно. |

---

## 5. Функциональные требования

### 5.1. Аккаунты и workspaces

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-100 | Регистрация по email + magic link или OAuth (Google, GitHub) | MUST |
| F-101 | Создание `Personal workspace` при регистрации | MUST |
| F-102 | Создание дополнительных `Team workspace` | MUST |
| F-103 | Приглашение участников в workspace по email | MUST |
| F-104 | Роли в workspace: `Owner`, `Admin`, `Editor`, `Viewer` | MUST |
| F-105 | Переключатель workspace в шапке UI | MUST |
| F-106 | Удаление аккаунта и экспорт всех данных (GDPR) | MUST |

### 5.2. Проекты

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-110 | Список проектов в workspace с поиском, тегами, фильтрами | MUST |
| F-111 | Создание проекта: `Blank`, `From idea (текст)`, `From file`, `From URL`, `From template` | MUST |
| F-112 | Дублирование проекта | MUST |
| F-113 | Архивирование (soft-delete) и восстановление за 30 дней | MUST |
| F-114 | Закрепление проектов в избранное | SHOULD |
| F-115 | Импорт `.sai` файла из десктопной версии (полная совместимость) | MUST |
| F-116 | Экспорт проекта в `.sai` для десктопа | MUST |

### 5.3. Три дерева (наследие из `v0.0.6`)

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-120 | Три дерева: `Разработка`, `Функции`, `Бизнес` создаются при инициализации | MUST |
| F-121 | Переключение активного дерева в один клик (`1`/`2`/`3`) | MUST |
| F-122 | Кросс-tree мосты (`CrossTreeEdge`) визуально отличимы | MUST |
| F-123 | Единая синхронизация всех трёх деревьев по кнопке | MUST |
| F-124 | Диалог ревью каскадных изменений перед коммитом | MUST |
| F-125 | Индикатор статуса синхронизации на каждом дереве | MUST |

### 5.4. Узлы

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-130 | Создание узла: hotkey `Tab`, двойной клик по канвасу, `+` на родительском узле | MUST |
| F-131 | Поля узла: `title` (обязательно), `description` (опционально), `tags`, `status`, `assignee` | MUST |
| F-132 | Inline-редактирование заголовка прямо на канвасе | MUST |
| F-133 | Подробный редактор открывается в правой панели или модалке | MUST |
| F-134 | Подсветка узлов без описания (как `v0.0.6` F-021) | MUST |
| F-135 | История изменений узла с источником (`user` / `ai` / `import`) | MUST |
| F-136 | Комментарии на узле (с упоминаниями `@user`) | SHOULD |

### 5.5. Связи

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-140 | Базовые типы: `parent-child`, `depends-on`, `relates-to` | MUST |
| F-141 | Cross-tree мост (`bridge`) | MUST |
| F-142 | Drag-from-handle для создания связи (как в n8n) | MUST |
| F-143 | Двунаправленные стрелки опционально | SHOULD |
| F-144 | Подписи на связях | SHOULD |

### 5.6. ИИ-чат

Наследуется бизнес-логика `v0.0.6` (`Node Chat` / `Global Chat`, режимы `Агент` / `Вопросы`), плюс web-специфика:

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-150 | `Node Chat` в боковой панели при клике на узел | MUST |
| F-151 | `Global Chat` вызывается hotkey `Cmd/Ctrl+K` или из шапки | MUST |
| F-152 | Режимы `Агент` / `Вопросы` (наследуется из `v0.0.6`) | MUST |
| F-153 | Streaming-ответы ИИ (SSE/WebSocket) | MUST |
| F-154 | `Provider Quick Switcher` в чате (как `v0.0.5` F-041) | MUST |
| F-155 | Пошаговое подтверждение мутаций (`v0.0.6` F-043) | MUST |
| F-156 | Прикрепление узлов к запросу drag-and-drop в чат | MUST |
| F-157 | Прикрепление файлов (PDF/MD/TXT/изображений) к чату | SHOULD |
| F-158 | Прерывание стриминга кнопкой `Stop` | MUST |

### 5.7. Ментальная карта (новое)

Полностью описано в [разделе 6](#6-ментальная-карта-mind-map-engine).

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-160 | Кнопка `Generate Mind Map` из идеи/файла/URL | MUST |
| F-161 | Переключатель `Tree View` ↔ `Mind Map View` (hotkey `M`) | MUST |
| F-162 | Радиальная и иерархическая раскладки | MUST |
| F-163 | `Expand node` — ИИ генерирует N подузлов | MUST |
| F-164 | `Deepen topic` — ИИ открывает чат с контекстом ветки | MUST |
| F-165 | Анимация фокуса на узле при клике | MUST |
| F-166 | Поиск по узлам с подсветкой и центровкой камеры | MUST |

### 5.8. Канвас

Полностью описано в [разделе 7](#7-канвас-и-взаимодействие-n8n-style).

### 5.9. Коллаборация

Полностью описано в [разделе 8](#8-коллаборация-и-шеринг).

### 5.10. Шаблоны и обмен

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-180 | Создание шаблона из проекта (как `v0.0.6` F-062) | MUST |
| F-181 | Создание проекта из шаблона | MUST |
| F-182 | Шаблоны workspace-уровня и публичные | MUST |
| F-183 | Импорт/экспорт шаблона как `.sai-template` файла | MUST |
| F-184 | Каталог публичных шаблонов (community) | SHOULD |
| F-185 | Рейтинг и форк шаблона | COULD |

### 5.11. Экспорт

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-190 | Экспорт в `Markdown`, `PDF`, `PNG`, `SVG` | MUST |
| F-191 | Экспорт в `JSON` (нативный формат проекта) | MUST |
| F-192 | Выбор узлов и деревьев в диалоге экспорта (как `v0.0.6`) | MUST |
| F-193 | Экспорт PNG ментальной карты в высоком разрешении | MUST |
| F-194 | Экспорт в формате Mermaid/PlantUML | SHOULD |
| F-195 | Публикация проекта как статической HTML-страницы (read-only share) | SHOULD |

### 5.12. Usage и биллинг

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-200 | Usage-страница: токены/запросы/стоимость на уровне workspace | MUST |
| F-201 | Лимиты ключей и предупреждение при подходе к лимиту | MUST |
| F-202 | Биллинг SaaS-подписки (Stripe): `Free`, `Pro`, `Team` | SHOULD |
| F-203 | Подписка не зависит от токенов ИИ (только за коллаборацию/лимиты проектов) | MUST |
| F-204 | Self-hosted версия не имеет биллинга | MUST |

### 5.13. Настройки

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-210 | Профиль: имя, аватар, email, смена пароля | MUST |
| F-211 | Хранилище API-ключей ИИ-провайдеров | MUST |
| F-212 | Тема (light/dark/system) | MUST |
| F-213 | Язык интерфейса (RU/EN, далее расширяемо) | MUST |
| F-214 | Hotkey-палитра с настройкой | SHOULD |
| F-215 | Импорт/экспорт настроек | COULD |

### 5.14. API и интеграции

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-220 | Public REST API для проектов, узлов, чатов | MUST |
| F-221 | API-токены на уровне workspace | MUST |
| F-222 | OpenAPI-спецификация и Swagger UI | MUST |
| F-223 | Webhooks на события (project.created, node.changed, sync.completed) | SHOULD |
| F-224 | Zapier / n8n / Make интеграции | COULD |
| F-225 | CLI (`sai-cli`) для self-host операторов | COULD |

---

## 6. Ментальная карта (Mind Map Engine)

### 6.1. Концепция

Ментальная карта — **не отдельная сущность**, а **второй способ отображения** того же графа узлов и связей. Никакой дублирующей структуры данных. При переключении `Tree View` → `Mind Map View` меняется только layout-движок, данные те же.

### 6.2. Генерация карты «с нуля»

| Источник | Что делает ИИ |
|----------|---------------|
| Текстовая идея | Извлекает темы → строит иерархию: корень → ветви → листья |
| Файл `.md` / `.pdf` / `.txt` | Чанкует, извлекает структуру, строит дерево |
| URL | Скрейпит контент (через серверный fetcher), далее как файл |
| Голос (загруженный аудио или запись с микрофона) | Транскрибирует (Whisper) → как текст |
| Существующий проект | Перестраивает раскладку без потери данных |

Промпт-стратегия:
- Один общий промпт-шаблон в `MindMapGenerationService`.
- Параметры: `max_depth` (по умолчанию 3), `branching_factor` (по умолчанию 4–6), `language` (наследуется из workspace).
- Output: строгий JSON со схемой узлов и связей, валидируется JSON-schema.
- При ошибке валидации — автоматический ретрай с уточнением промпта (до 2 раз).

### 6.3. Интерактивное углубление

#### Действие `Expand`
- Клик на узел → правый клик → `Expand with AI` (или hotkey `E`).
- ИИ получает контекст: текущий узел, его родители, до 2 уровней соседей.
- Возвращает N (по умолчанию 4) предложенных дочерних узлов.
- Пользователь принимает по одному или все сразу (`v0.0.6` F-043/F-044).

#### Действие `Deepen`
- Hotkey `D` или кнопка на узле.
- Открывает `Node Chat` в режиме `Вопросы` с предзаполненным сообщением:
  «Расскажи подробнее про [title]. Контекст ветки: [path]».
- Дальше — обычный чат.

#### Действие `Refactor`
- Hotkey `R` или меню узла.
- ИИ может предложить разделить узел на несколько, объединить с соседями, переименовать.
- Все мутации — через подтверждение.

### 6.4. Раскладки

| Раскладка | Когда подходит | Алгоритм |
|-----------|----------------|----------|
| **Radial** | Малые-средние карты (до ~80 узлов) | Узлы располагаются концентрическими кольцами от корня |
| **Hierarchical** (top-down / left-right) | Структурные дерева (`Разработка`) | Layered layout (Sugiyama) |
| **Force-directed** | Хаос с межсвязями | d3-force / cytoscape-cola |
| **Free** (`Tree View`) | Пользователь сам раскладывает | Координаты сохраняются в узле |

Переключение раскладок:
- Кнопка в правом верхнем углу канваса.
- При смене на `Free` сохраняются текущие координаты.
- При смене на автораскладку координаты пересчитываются с анимацией (≤ 600 мс).

### 6.5. Камера и навигация

- Smooth zoom: 0.1× — 4×, mouse wheel и pinch.
- Pan: drag правой кнопкой, средняя кнопка, или `Space + drag`.
- `F` — fit-to-screen.
- `0` — reset zoom.
- Двойной клик на узле — центровать и приблизить.
- При выборе узла из поиска — плавная анимация фокуса (400 мс).

### 6.6. Источник каждого узла

Каждый узел хранит `origin`:

```json
{
  "origin": {
    "type": "ai_expand | ai_generate | manual | template | import",
    "prompt_hash": "sha256...",
    "parent_chat_id": "...",
    "created_at": "..."
  }
}
```

Это даёт прослеживаемость: «откуда этот узел появился» (важно для трасты к ИИ-сгенерированному контенту).

### 6.7. Производительность

| Параметр | Целевое значение |
|----------|------------------|
| Плавный рендер | 60 fps на канвасе до 500 узлов |
| Рендер 2000 узлов | ≥ 30 fps (через виртуализацию и WebGL/Canvas-рендер) |
| Время генерации карты из идеи (300 слов) | ≤ 20 сек на median LLM-запросе |
| Время `Expand` одного узла | ≤ 10 сек |

При больших картах (> 500 узлов) автоматически включается **WebGL-рендер** (PixiJS / regl) вместо SVG.

---

## 7. Канвас и взаимодействие (n8n-style)

### 7.1. Структура канваса

```
┌─────────────────────────────────────────────────────────────┐
│ Top bar: workspace ▼  /  project  /  tree tabs  /  share    │
├──────────┬───────────────────────────────────┬──────────────┤
│  Left:   │                                   │  Right:      │
│  outline │      Canvas (Tree / Mind Map)     │  Node panel  │
│  + search│                                   │  / Chat      │
│  + tags  │                                   │              │
├──────────┴───────────────────────────────────┴──────────────┤
│ Bottom: minimap  |  zoom  |  sync status  |  presence       │
└─────────────────────────────────────────────────────────────┘
```

### 7.2. Hotkeys

| Hotkey | Действие |
|--------|----------|
| `Cmd/Ctrl + K` | Command palette / Global Chat |
| `Cmd/Ctrl + P` | Поиск по проекту |
| `Cmd/Ctrl + S` | Принудительное сохранение |
| `Cmd/Ctrl + Z` / `Shift+Z` | Undo / Redo |
| `Tab` | Создать дочерний узел от выделенного |
| `Enter` | Создать соседний узел |
| `Delete` / `Backspace` | Удалить выделенное |
| `Space` (hold) | Pan canvas |
| `M` | Tree View ↔ Mind Map View |
| `1` / `2` / `3` | Переключить дерево |
| `E` | Expand узел через ИИ |
| `D` | Deepen — открыть чат по узлу |
| `R` | Refactor — предложения ИИ по узлу |
| `F` | Fit-to-screen |
| `0` | Reset zoom |
| `/` | Поиск |
| `?` | Помощь по hotkeys |

### 7.3. Multi-select и групповые операции

- Drag-select рамкой.
- `Shift + click` — добавить в выделение.
- Bulk-операции: `Delete`, `Move to tree`, `Tag`, `Change status`, `Export selected`.

### 7.4. Sticky notes

- Цветные заметки на канвасе (не узлы, не участвуют в синхронизации).
- Markdown внутри.
- Привязка к узлу опциональна.

### 7.5. Minimap

- Правый нижний угол.
- Кликабельная, навигация одним кликом.
- Показывает viewport как прямоугольник.

### 7.6. Quick-add меню

- Двойной клик по пустому канвасу → меню: `New node`, `Sticky note`, `Bridge to other tree`, `Paste from clipboard`.

### 7.7. Темы

- Light, Dark, System.
- Канвас имеет 2 предустановленные палитры узлов: «семантическая» (тип = цвет) и «по дереву» (development=blue, functional=green, business=amber).

---

## 8. Коллаборация и шеринг

### 8.1. Совместное редактирование

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-300 | Real-time co-editing документа проекта | MUST |
| F-301 | CRDT (Yjs) как основа синхронизации | MUST |
| F-302 | Видимые курсоры участников с именем и цветом | MUST |
| F-303 | Видимое выделение узлов другими участниками | MUST |
| F-304 | Presence-индикатор в шапке (аватары) | MUST |
| F-305 | Конфликт-free слияние без блокировок | MUST |
| F-306 | Optimistic UI с откатом при отклонении сервером | MUST |

### 8.2. Комментарии

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-310 | Комментарии на узле / связи / sticky | MUST |
| F-311 | Упоминания `@user` с уведомлением | MUST |
| F-312 | Резолв треда, фильтр `Open` / `Resolved` | MUST |
| F-313 | Markdown в комментариях | MUST |

### 8.3. Шеринг

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-320 | Шеринг по ссылке: `View` / `Comment` / `Edit` | MUST |
| F-321 | Шеринг по email (приглашение в проект) | MUST |
| F-322 | Публичный read-only режим (без логина) | SHOULD |
| F-323 | Эмбед проекта в iframe (для блогов) | COULD |
| F-324 | Защита ссылки паролем | SHOULD |
| F-325 | Истечение ссылки по времени | SHOULD |

### 8.4. История и snapshots

| ID | Требование | Приоритет |
|----|-----------|-----------|
| F-330 | Автоматические snapshots каждые N изменений | MUST |
| F-331 | Ручное создание именованного snapshot | MUST |
| F-332 | Просмотр истории snapshots с diff | MUST |
| F-333 | Восстановление из snapshot (создаёт новую ветку) | MUST |

---

## 9. Мультитенантность, аккаунты, BYOK

### 9.1. Иерархия

```
Account (user)
 └── Workspace (personal или team)
      ├── Members + Roles
      ├── API Keys для ИИ-провайдеров (BYOK)
      ├── API Tokens для интеграций
      ├── Projects
      │    └── Trees + Nodes + Edges + Chats + Snapshots
      └── Templates
```

### 9.2. Роли

| Роль | Project | Workspace |
|------|---------|-----------|
| `Owner` | Все права | Биллинг, удаление |
| `Admin` | Все права | Управление членами и ключами |
| `Editor` | Чтение + редактирование | Создание проектов |
| `Commenter` | Чтение + комментарии | — |
| `Viewer` | Только чтение | — |

### 9.3. BYOK (Bring Your Own Key)

Принцип из `sai_business_logic.md` сохраняется и усиливается:

| Аспект | Реализация |
|--------|-----------|
| Где хранятся ключи | Шифрование на сервере с AES-256-GCM, ключ дешифровки — derived из master-key пользователя |
| Кто видит ключи | Никто кроме самого пользователя. Admin видит только метаданные (имя, провайдер, последнее использование) |
| Прямые запросы к LLM | По возможности — браузер шлёт напрямую (через CORS-разрешённые провайдеры). Где невозможно (Anthropic в браузере) — через серверный прокси без логирования контента |
| Поддерживаемые провайдеры на MVP | OpenAI, Anthropic, OpenRouter, Google AI Studio, локальный Ollama (через URL) |
| Лимиты | Workspace-level лимит токенов в сутки/месяц (мягкое предупреждение) |

### 9.4. Аутентификация

| Метод | MVP | v1 |
|-------|-----|----|
| Email + magic link | ✅ | ✅ |
| Google OAuth | ✅ | ✅ |
| GitHub OAuth | — | ✅ |
| SAML / SSO | — | ✅ (Team plan / self-host enterprise) |
| 2FA (TOTP) | — | ✅ |

Сессии: JWT access token + refresh token (httpOnly cookie). Срок access 15 мин, refresh 30 дней.

---

## 10. Нефункциональные требования

| ID | Требование | Целевое значение |
|----|-----------|------------------|
| N-100 | Time-to-interactive начального экрана | ≤ 2.5 сек на 4G |
| N-101 | First contentful paint | ≤ 1.5 сек |
| N-102 | Latency CRDT-операции | p95 ≤ 100 мс в одном регионе |
| N-103 | Канвас 60 fps до 500 узлов | без лагов на M1/Ryzen 5 |
| N-104 | Доступность UI (WCAG 2.1) | AA |
| N-105 | i18n с RTL-ready разметкой | минимум RU + EN |
| N-106 | Offline-режим (read + локальные мутации) | поддержка через SW + IndexedDB |
| N-107 | Браузеры | Chrome/Edge/Firefox/Safari (последние 2 версии) |
| N-108 | Mobile | Responsive UI, тач-жесты, генерация и просмотр; редактирование ограниченно |
| N-109 | Безопасность | OWASP Top-10, CSP, HSTS, secure cookies |
| N-110 | SLA Cloud SaaS | 99.5% MRR uptime на Pro+ |
| N-111 | RPO / RTO Cloud | RPO ≤ 5 мин, RTO ≤ 1 час |
| N-112 | Логирование | structured JSON, корреляция request_id |
| N-113 | Метрики | Prometheus-compatible, ключевые SLI |
| N-114 | Трассировка | OpenTelemetry |
| N-115 | Изоляция данных tenants | Row-level security в БД, отдельный namespace для blob |
| N-116 | Бэкапы Cloud | Ежедневный full + WAL для PITR на 7 дней |
| N-117 | Размер docker-образа self-host | ≤ 500 МБ |
| N-118 | Совместимость данных | Прямая загрузка проектов из десктопа `v0.0.4+` без миграций; экспорт обратно |

---

## 11. UI/UX требования

### 11.1. Информационная архитектура

```
/  → Dashboard (список проектов)
/p/:projectId  → Канвас
/p/:projectId/node/:nodeId  → Глубинная ссылка на узел (фокус + чат)
/p/:projectId/chat/:chatId  → Прямая ссылка на сессию чата
/templates  → Каталог шаблонов
/usage  → Usage workspace
/settings  → Настройки
/admin  → Управление workspace (для admin/owner)
```

Все важные состояния — в URL. Шеринг ссылки = шеринг точного состояния (узел в фокусе, открытый чат).

### 11.2. Дизайн-система

- Базируется на shadcn/ui + Tailwind.
- Иконки — Lucide.
- Шрифт интерфейса — Inter; шрифт узлов — Inter; моноширинный — JetBrains Mono.
- 4px grid.
- Радиусы: 4 / 8 / 12.
- Анимации: 200–400 мс, easing `cubic-bezier(0.4, 0, 0.2, 1)`.

### 11.3. Главные экраны

| Экран | Назначение |
|-------|-----------|
| **Dashboard** | Список проектов, поиск, фильтры по тегам, кнопки `New` |
| **Canvas** | Главный рабочий экран (Tree / Mind Map View) |
| **Templates** | Каталог + создание из шаблона |
| **Usage** | Графики токенов и расходов, лимиты, история |
| **Workspace Settings** | Члены, роли, ключи, биллинг |
| **Profile Settings** | Личные данные, темы, hotkeys |

### 11.4. Onboarding

- 3-шаговый туториал на первом входе: `Создай идею → Расскажи ИИ → Получи карту`.
- Стартовый шаблон-демо (можно пропустить).
- Подсказки в Mind Map View первого открытия.

### 11.5. Empty states

- Каждое пустое состояние имеет CTA, объясняющий следующий шаг.
- Иллюстрации в стиле Sai (минималистичные линии).

### 11.6. Доступность

- Контраст текста ≥ 4.5:1.
- Полная клавиатурная навигация (Tab-индексы, фокус-кольца).
- ARIA-роли для канваса (`role="application"` + alternative list view).
- Поддержка screen-reader для outline-панели.
- Уважение `prefers-reduced-motion`.

---

## 12. Технический стек

### 12.1. Frontend

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| Framework | **Next.js 15 (App Router)** | SSR/RSC, хороший DX, легко деплоить и self-host |
| UI | **React 19 + TypeScript 5.x** | стандарт индустрии |
| Styling | **Tailwind CSS 4 + shadcn/ui** | скорость разработки, согласованный дизайн |
| State (UI) | **Zustand** | минимализм, без бойлерплейта |
| State (граф) | **Yjs** (CRDT) | реалтайм + offline + history |
| Канвас | **React Flow 12** (для tree) + **PixiJS 8** (WebGL для больших Mind Map) | React Flow — отличный DX, Pixi — производительность |
| Forms / Validation | **react-hook-form + zod** | типобезопасные формы |
| Data fetching | **TanStack Query** | кэш и инвалидация |
| RPC | **tRPC** | типобезопасный API end-to-end |
| Auth (client) | **Auth.js (NextAuth) v5** | OAuth + magic link из коробки |
| Editor (описания узлов) | **TipTap 2** | Markdown + rich text |
| i18n | **next-intl** | формат ICU |
| Offline | **Workbox** (Service Worker) + **IndexedDB** через `idb` | стандарт |
| Тестирование | **Vitest** + **Playwright** | unit + e2e |

### 12.2. Backend

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| Runtime | **Node.js 22 LTS** | совместимость с Next.js и Yjs |
| Framework | **Next.js Route Handlers** (где можно) + **NestJS** (для тяжёлой части API) | модульный backend |
| Realtime | **y-websocket** + кастомный сервер на **ws** или **Hocuspocus** | прод-ready CRDT-сервер |
| Auth | **Auth.js (NextAuth) v5** server-side | sessions + providers |
| ORM | **Prisma 5** | типобезопасный доступ к БД |
| Queue | **BullMQ** на Redis | для тяжёлых ИИ-задач (генерация карты) |
| Кэш | **Redis 7** | сессии, rate-limit, очереди |
| Объектное хранилище | **S3-совместимое** (MinIO в self-host, R2/S3 в Cloud) | файлы, экспорты, snapshots |
| AI orchestration | Тонкий слой над **Vercel AI SDK** | стриминг, мульти-провайдер |
| PDF-генерация | **playwright-pdf** или **@react-pdf/renderer** | server-side рендер |

### 12.3. База данных

| Назначение | Технология |
|-----------|-----------|
| Реляционная (users, workspaces, projects metadata, billing) | **PostgreSQL 16** |
| Документы проектов (граф, узлы) | **PostgreSQL JSONB** или отдельная коллекция в **MongoDB**. Решение фиксируется в [§20 открытых вопросах](#20-открытые-вопросы-и-риски) |
| Поиск по проектам | **PostgreSQL FTS** на MVP, далее **Meilisearch** |
| Векторный поиск (для RAG в чате) | **pgvector** |
| Сессии CRDT | хранение в Postgres (Yjs encoded state) + Redis для активных комнат |

### 12.4. Инфраструктура

| Аспект | Технология |
|--------|-----------|
| Контейнеризация | Docker + Docker Compose |
| Оркестрация (Cloud) | Kubernetes (управляемый: EKS / GKE / Hetzner) |
| Reverse proxy | Caddy (self-host по умолчанию), Nginx/Cloudflare (Cloud) |
| CI/CD | GitHub Actions |
| Мониторинг | Prometheus + Grafana + Loki |
| Трассировка | OpenTelemetry → Tempo |
| Алерты | Alertmanager → Slack / Telegram |
| Регистр образов | GHCR |

### 12.5. Обоснование выбора

- **Next.js + Node.js**: единый язык для front и back упрощает контракты, позволяет переиспользовать zod-схемы.
- **Yjs**: де-факто стандарт CRDT, выдерживает прод-нагрузку, есть y-websocket и хостеды.
- **React Flow + PixiJS** в паре: React Flow даёт идеальный DX для типовых деревьев, PixiJS — масштаб для больших карт.
- **PostgreSQL**: одна БД покрывает relational + JSONB + vector + FTS. Не плодим зоопарк.
- **Vercel AI SDK**: стриминг, унификация провайдеров, активная разработка.

---

## 13. Архитектура системы

### 13.1. Высокоуровневая схема

```
┌──────────────────────────────────────────────────────────┐
│                       Browser (SPA + SW)                  │
│  React + Yjs (local) + IndexedDB cache + Tailwind UI     │
└──────┬──────────────────┬──────────────────┬─────────────┘
       │ HTTPS (tRPC)     │ WSS (Yjs)        │ Streaming (SSE)
       ▼                  ▼                  ▼
┌──────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  API Gateway │ │ Realtime (CRDT)  │ │  AI Orchestrator │
│  Next.js +   │ │ Hocuspocus / ws  │ │  Vercel AI SDK   │
│  NestJS      │ │                  │ │                  │
└──────┬───────┘ └─────────┬────────┘ └────────┬─────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────────┐
│            Domain Services (TS, monorepo)                │
│  SyncService | BridgeService | MutationService           │
│  MindMapGenerationService | ChatService | UsageTracker   │
│  TemplateService | ExportService | HistoryService        │
└──────┬───────────────────┬─────────────────────┬─────────┘
       ▼                   ▼                     ▼
┌──────────────┐   ┌──────────────┐    ┌──────────────────┐
│  PostgreSQL  │   │   Redis 7    │    │  S3-compatible   │
│  + pgvector  │   │  + BullMQ    │    │  (MinIO / S3)    │
└──────────────┘   └──────────────┘    └──────────────────┘
                                                ▲
                                                │
                                         External LLM
                                  (OpenAI / Anthropic / etc.)
```

### 13.2. Слои домена

Эти сервисы — переосмысление модулей из `sai_0_0_6.md §7`, адаптированные под web:

| Сервис | Назначение | Источник в десктопе |
|--------|-----------|---------------------|
| `SyncService` | Синхронизация 3 деревьев, конфликт-резолвер | `v0.0.6` |
| `BridgeService` | Cross-tree мосты | `v0.0.6` |
| `MutationService` | Подготовка и применение ИИ-операций | `v0.0.6` |
| `HistoryService` | Snapshots + версии | `v0.0.6` + новое для web |
| `RecoveryService` | Восстановление из логов | `v0.0.6` |
| `TemplateService` | Шаблоны (личные/workspace/public) | `v0.0.6` + marketplace |
| `MindMapGenerationService` | **Новое.** Генерация карты из идеи/файла/URL/аудио | — |
| `MindMapExpandService` | **Новое.** Углубление узла через ИИ | — |
| `ChatService` | Node Chat + Global Chat с streaming | расширено |
| `ProviderManager` | BYOK + переключатель | `v0.0.5` |
| `UsageTracker` | Токены/стоимость на уровне workspace | `v0.0.6` |
| `CollaborationService` | **Новое.** Presence, комментарии, права | — |
| `ShareService` | **Новое.** Ссылки, эмбед, public read-only | — |
| `ExportService` | PDF/MD/PNG/SVG/HTML | расширено |
| `BillingService` | **Новое (только Cloud).** Stripe-интеграция | — |
| `AuthService` | OAuth, magic link, сессии | новое для web |
| `WebhookService` | Исходящие webhooks | новое |

### 13.3. Поток «Создание ментальной карты»

```
User (UI)
  └── POST /api/projects/:id/mind-map/generate { source: "text"|"file"|"url", payload }
        └── Запись задачи в BullMQ
              └── Worker: MindMapGenerationService
                    ├── Подготовка контента (chunking)
                    ├── Запрос к LLM через ProviderManager (BYOK ключ)
                    │     ├── Стриминг прогресса по WS обратно клиенту
                    │     └── Валидация JSON по zod
                    ├── Запись узлов и связей в Postgres + Yjs CRDT
                    └── Эмит события `mindmap.generated`
                          └── Клиент рендерит карту с анимацией
```

### 13.4. Поток «Co-editing»

```
Browser A (Yjs doc) <─WS─> Hocuspocus <─WS─> Browser B (Yjs doc)
                              │
                              ├── persist snapshot каждые N сек в Postgres
                              ├── awareness (cursors, selection) broadcast
                              └── access control (read/write по правам)
```

### 13.5. Поток «Чат с подтверждаемой мутацией»

```
UI → tRPC /chat.stream → ChatService
                            ├── собрать контекст (узел + соседи / весь граф)
                            ├── вызвать LLM через ProviderManager
                            ├── streaming токенов обратно (SSE/WS)
                            └── если AI вернул tool_call → MutationService
                                       ├── валидация JSON-schema
                                       ├── создать preview в DB
                                       └── показать пользователю карточку
                                                ├── Apply → CRDT update + Postgres
                                                ├── Skip → log
                                                └── Stop → cancel stream
```

---

## 14. Модель данных

### 14.1. Реляционная часть (Postgres)

```sql
-- USERS / WORKSPACES / MEMBERSHIPS
users (id, email, name, avatar_url, created_at, updated_at)
workspaces (id, name, slug, owner_id, plan, created_at)
workspace_members (workspace_id, user_id, role, joined_at)

-- API KEYS (BYOK)
ai_provider_keys (
  id, workspace_id, provider, name,
  encrypted_key, key_fingerprint,
  monthly_limit_tokens, used_tokens,
  created_by, created_at
)

-- API TOKENS (для интеграций)
api_tokens (id, workspace_id, name, hashed_token, scopes, last_used_at)

-- PROJECTS
projects (
  id, workspace_id, name, slug, description,
  schema_version, settings JSONB,
  created_by, created_at, updated_at, archived_at
)

-- PROJECT ACCESS (для шеринга вне workspace)
project_shares (
  id, project_id, principal_type, principal_id,
  role, expires_at, password_hash NULLABLE,
  share_token UNIQUE
)

-- SNAPSHOTS
project_snapshots (
  id, project_id, label, created_by, created_at,
  yjs_state BYTEA, metadata JSONB
)

-- USAGE
usage_events (
  id, workspace_id, project_id, user_id,
  provider, model, prompt_tokens, completion_tokens,
  estimated_cost_usd, request_id, created_at
)

-- AUDIT LOG
audit_log (id, workspace_id, actor_id, action, target, payload JSONB, created_at)
```

### 14.2. Документная часть (граф проекта)

Граф хранится в **двух местах одновременно**:
- Yjs CRDT-документ (binary state) — для realtime.
- JSONB-проекция в Postgres `project_graph` — для query (поиск, экспорт, аналитика).

```ts
type ProjectGraph = {
  projectId: string;
  schemaVersion: number;
  trees: {
    development: Tree;
    functional: Tree;
    business: Tree;
  };
  bridges: CrossTreeEdge[];
  chats: ChatSession[];
};

type Tree = {
  id: string;
  rootNodeId: string;
  nodes: Record<NodeId, Node>;
  edges: Record<EdgeId, Edge>;
  layout: LayoutState;
};

type Node = {
  id: string;
  treeId: string;
  title: string;
  description: string | null;
  status: 'idea' | 'in_progress' | 'done' | 'blocked' | null;
  tags: string[];
  assigneeId: string | null;
  position: { x: number; y: number };
  collapsed: boolean;
  origin: NodeOrigin;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type NodeOrigin = {
  type: 'manual' | 'ai_generate' | 'ai_expand' | 'template' | 'import';
  promptHash?: string;
  parentChatId?: string;
  importedFromVersion?: string;
};

type Edge = {
  id: string;
  sourceId: NodeId;
  targetId: NodeId;
  kind: 'parent-child' | 'depends-on' | 'relates-to';
  label?: string;
};

type CrossTreeEdge = {
  id: string;
  sourceTree: TreeKey;
  sourceNodeId: NodeId;
  targetTree: TreeKey;
  targetNodeId: NodeId;
  label?: string;
  comment?: string;
};

type ChatSession = {
  id: string;
  scope: 'node' | 'global';
  nodeId?: NodeId;
  mode: 'agent' | 'qa';
  provider: string;
  model: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

type LayoutState = {
  view: 'tree' | 'mind-map';
  layout: 'free' | 'radial' | 'hierarchical' | 'force';
  zoom: number;
  pan: { x: number; y: number };
};
```

### 14.3. Схема версионирования

- `schemaVersion` инкрементируется при breaking changes.
- Каждая миграция — файл в `packages/db/migrations/graph/<version>.ts` с функциями `up(json)` / `down(json)`.
- При загрузке проекта старой версии — автоматический `up` до текущей.

### 14.4. Совместимость с десктопом

- `.sai`-файл десктопа = JSON с теми же базовыми полями.
- При импорте — мигратор приводит к web-схеме (добавляет `origin`, `layout`, `assigneeId=null` и т.п.).
- Экспорт в `.sai` обнуляет web-only поля.

---

## 15. API и протоколы

### 15.1. Транспорт

| Протокол | Назначение |
|----------|-----------|
| **HTTPS + tRPC** | CRUD: workspaces, projects, settings, keys, billing |
| **HTTPS + REST** (под капотом tRPC) | Публичный API для интеграций (с OpenAPI) |
| **WebSocket (y-websocket / Hocuspocus)** | Realtime CRDT и presence |
| **SSE / WebSocket** | Streaming ответов ИИ |
| **HTTPS + Webhooks (outgoing)** | События к внешним системам |

### 15.2. Основные эндпоинты (REST поверх tRPC)

```
# Auth
POST   /api/auth/signin            (magic link / OAuth)
POST   /api/auth/signout
GET    /api/auth/session

# Workspaces
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:id
PATCH  /api/workspaces/:id
POST   /api/workspaces/:id/members
DELETE /api/workspaces/:id/members/:userId

# Projects
GET    /api/workspaces/:wid/projects
POST   /api/workspaces/:wid/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
POST   /api/projects/:id/duplicate
POST   /api/projects/:id/archive
POST   /api/projects/:id/import       (multipart .sai)
GET    /api/projects/:id/export       ?format=sai|md|pdf|png|svg|json

# Mind Map
POST   /api/projects/:id/mind-map/generate   { source, payload }
POST   /api/projects/:id/nodes/:nid/expand   { count, prompt? }
POST   /api/projects/:id/nodes/:nid/refactor

# Sync
POST   /api/projects/:id/sync
GET    /api/projects/:id/sync/preview

# Chat
POST   /api/projects/:id/chat/start          { scope, nodeId?, mode, provider, model }
POST   /api/chats/:cid/messages              (streaming SSE)
POST   /api/chats/:cid/stop
DELETE /api/chats/:cid

# Templates
GET    /api/workspaces/:wid/templates
POST   /api/workspaces/:wid/templates
GET    /api/templates/public                 (каталог)
POST   /api/projects/:id/save-as-template

# Sharing
POST   /api/projects/:id/share               { role, expiresAt?, password? }
GET    /api/shared/:token                    (public)

# Usage
GET    /api/workspaces/:wid/usage            ?from&to

# AI Keys
GET    /api/workspaces/:wid/ai-keys
POST   /api/workspaces/:wid/ai-keys
DELETE /api/workspaces/:wid/ai-keys/:kid

# Webhooks
GET    /api/workspaces/:wid/webhooks
POST   /api/workspaces/:wid/webhooks
```

### 15.3. WebSocket-каналы

```
wss://.../yjs/:projectId          — CRDT-документ проекта
wss://.../presence/:projectId     — presence / cursors
wss://.../chat/:chatId            — стриминг ответов ИИ
```

### 15.4. События webhook

| Событие | Payload |
|---------|---------|
| `project.created` | project metadata |
| `project.updated` | diff |
| `node.created` / `node.updated` / `node.deleted` | node + actor |
| `sync.completed` | summary изменений |
| `chat.message.completed` | сообщение + tokens |
| `mind_map.generated` | summary узлов |

---

## 16. Безопасность и приватность

| ID | Требование |
|----|-----------|
| S-100 | TLS 1.2+ обязателен, HSTS включён |
| S-101 | CSP с `default-src 'self'`, явный whitelist для LLM-доменов |
| S-102 | Защита от CSRF (double-submit + SameSite=Lax) |
| S-103 | Rate-limit на чувствительные эндпоинты (Redis token bucket) |
| S-104 | Хэширование паролей: bcrypt (для self-host локальных аккаунтов) |
| S-105 | API-токены хранятся хэшированными (`sha-256`), отображаются один раз |
| S-106 | API-ключи ИИ шифруются (`AES-256-GCM`) с master-key из KMS |
| S-107 | Row-Level Security в Postgres по `workspace_id` |
| S-108 | Audit log на критические действия (роли, ключи, удаления) |
| S-109 | Запросы к LLM не логируются на серверной стороне с контентом |
| S-110 | Файлы загружаются с проверкой mime/размера, антивирус-сканер (ClamAV) опционально |
| S-111 | XSS: все пользовательские строки рендерятся через safe-renderer |
| S-112 | DOMPurify для пользовательского Markdown |
| S-113 | Cookies: `httpOnly`, `Secure`, `SameSite=Lax` |
| S-114 | GDPR: экспорт всех данных + полное удаление аккаунта в течение 30 дней |
| S-115 | Доступ по share-ссылке логируется, можно отозвать |
| S-116 | Поддержка `X-Forwarded-For` корректно для rate-limit за reverse proxy |

---

## 17. Деплой: Cloud SaaS + Self-hosted

### 17.1. Single-artefact подход

Один и тот же docker-образ работает в обоих режимах. Различия — через переменные окружения и `SAI_MODE=cloud|selfhost`.

| Аспект | Cloud | Self-hosted |
|--------|-------|-------------|
| Биллинг (Stripe) | включён | выключен |
| Регистрация | открытая | закрытая или whitelisted |
| Многотенантность | да | да (single workspace допускается) |
| Бэкапы | автоматические | на пользователя |
| Обновления | автоматические | через `docker pull` |
| Лимиты | по плану | без жёстких лимитов |

### 17.2. Self-hosted: Docker Compose

Минимальный набор сервисов:

```yaml
services:
  app:           # Next.js + API
  realtime:      # Hocuspocus
  worker:        # BullMQ воркер для ИИ-задач
  postgres:
  redis:
  minio:         # опционально, для файлов
  caddy:         # reverse proxy + auto-HTTPS
```

Целевая характеристика: разворачивается одной командой `docker compose up -d` с дефолтным `.env.example`, далее открытие `https://<host>` и создание admin.

Системные требования self-host (минимум):
- 2 vCPU, 4 ГБ RAM, 20 ГБ SSD.
- Linux (Ubuntu 22.04+ / Debian 12).

### 17.3. Cloud: Kubernetes (целевая)

- Helm-чарт `sai-web/` для деплоя.
- Auto-scale `app` и `worker` по CPU / queue depth.
- Управляемый Postgres (RDS/Cloud SQL/Hetzner DB).
- Объектное хранилище R2/S3.
- CDN перед статикой.

### 17.4. Обновления

- Семантическое версионирование `MAJOR.MINOR.PATCH`.
- Канал `stable` и `edge`.
- Миграции БД автоматически при старте `app` (с health check, rollback при ошибке).
- Документированный downgrade path для последних 2 minor-версий.

### 17.5. Мониторинг (self-host опционально)

- Endpoint `/healthz` (liveness) и `/readyz` (readiness).
- Метрики `/metrics` (Prometheus).
- Логи в `stdout` JSON-формате.

---

## 18. План реализации (MVP → v1 → v1.5)

### 18.1. MVP (3 месяца)

Минимальный продукт, который решает JTBD-1 и JTBD-3 для одного пользователя в SaaS.

| # | Эпик | Содержание |
|---|------|-----------|
| 1 | Skeleton | Монорепо, Next.js, Postgres, auth (magic link + Google), workspace, base UI |
| 2 | Канвас | React Flow, узлы, связи, hotkeys, undo/redo, мини-карта |
| 3 | 3 дерева | Импорт из десктопа, переключение, синхронизация, мосты |
| 4 | Ментальная карта (генерация) | `MindMapGenerationService` из текста, базовая радиальная раскладка |
| 5 | ИИ-чат | Node + Global, `Агент`/`Вопросы`, streaming, провайдеры (OpenAI/Anthropic/OpenRouter), BYOK |
| 6 | Мутации с подтверждением | `MutationService`, карточки операций |
| 7 | Экспорт | MD + PDF + PNG + JSON |
| 8 | Usage | Подсчёт токенов, страница Usage |
| 9 | Деплой | Docker Compose self-host, базовый Cloud-инстанс |

**Definition of Done MVP:** пользователь регистрируется, импортирует `.sai`-проект из десктопа, генерирует ментальную карту из идеи, ведёт чат, синхронизирует 3 дерева, экспортирует в PDF/MD.

### 18.2. v1.0 (+ 2 месяца)

Коллаборация и зрелость.

| # | Эпик | Содержание |
|---|------|-----------|
| 1 | Real-time co-editing | Yjs + Hocuspocus, presence, cursors |
| 2 | Комментарии | На узле/связи, упоминания, нотификации |
| 3 | Шеринг | Ссылки view/comment/edit, public read-only |
| 4 | Snapshots и история | Авто + ручные, diff, восстановление |
| 5 | Mind Map: Expand & Deepen | Углубление узла, refactor через ИИ |
| 6 | Большие карты | WebGL-рендер (PixiJS) при > 500 узлов |
| 7 | Шаблоны | Сохранение, импорт/экспорт, личные + workspace |
| 8 | Mobile responsive | Просмотр и базовое редактирование |
| 9 | i18n | RU + EN |
| 10 | Биллинг (Cloud) | Stripe, планы Free/Pro/Team |

**Definition of Done v1.0:** команда из 3+ человек ведёт проект совместно, шерит view-ссылку клиенту, восстанавливается из snapshots.

### 18.3. v1.5 (+ 2 месяца)

Зрелая платформа.

| # | Эпик | Содержание |
|---|------|-----------|
| 1 | Public API + OpenAPI | Полный CRUD через API-токены |
| 2 | Webhooks | Outgoing events |
| 3 | Каталог публичных шаблонов | Community-marketplace, рейтинги |
| 4 | SAML/SSO + 2FA | Для Team-плана и Enterprise self-host |
| 5 | RAG в чате | pgvector, чат «по содержимому проекта» |
| 6 | Голосовой ввод | Whisper для генерации карт |
| 7 | Mermaid/PlantUML экспорт | Дополнительные форматы |
| 8 | Интеграции | Zapier, n8n, Linear, Notion (через API) |

### 18.4. Дорожная карта (вне scope первых релизов)

- AI-агенты как fully-autonomous (мульти-step без подтверждения, опционально).
- Плагины коммьюнити (custom node types).
- Cloud sync с десктопом в обе стороны.
- Native mobile apps.

---

## 19. Критерии приёмки

Sai Web считается готовой по этапам:

### MVP принят, если:
1. Пользователь регистрируется и создаёт workspace ≤ 60 сек.
2. Импорт `.sai`-проекта десктопа `v0.0.4+` корректен (lossless для базовых полей).
3. Канвас выдерживает 500 узлов без лагов.
4. Ментальная карта генерируется из 300-словного описания ≤ 20 сек на median LLM.
5. ИИ-чат работает в `Агент` и `Вопросы` с streaming.
6. Все мутации ИИ подтверждаются явно (пошагово или пакетно).
7. Три дерева синхронизируются с диалогом ревью.
8. Cross-tree мосты создаются и навигируются.
9. Экспорт PDF/MD/PNG/JSON стабильно работает.
10. BYOK ключи безопасно хранятся (AES-256-GCM, не доступны admin без явного действия).
11. Self-host разворачивается одной командой `docker compose up`.

### v1.0 принят, если дополнительно:
12. Двое пользователей редактируют один проект, видя курсоры друг друга, без конфликтов.
13. Комментарии работают, упоминания шлют уведомления.
14. Share-ссылка `view` доступна без логина (если разрешено).
15. Snapshots создаются авто, восстановление работает.
16. Mind Map: `Expand` создаёт ≤ 6 предложений за ≤ 10 сек.
17. WebGL-рендер включается автоматически при > 500 узлов.
18. UI работает на iOS Safari и Android Chrome (просмотр + базовое редактирование).
19. Биллинг проводит хотя бы одну успешную транзакцию через Stripe в Cloud.

### v1.5 принят, если дополнительно:
20. Public API проходит контракт-тесты, OpenAPI публикуется.
21. Webhook доставляется ≥ 99.5% за 30 дней.
22. RAG-чат отвечает с цитатами из проекта.
23. SAML SSO подключается к Okta/Google Workspace.
24. Голосовой ввод корректно транскрибирует на RU и EN.

---

## 20. Открытые вопросы и риски

### 20.1. Открытые вопросы (требуют решения до MVP)

1. **Документная БД vs JSONB.** Хранить граф в Postgres JSONB или вынести в MongoDB / CouchDB? Решение влияет на сложность стека. **Рекомендация:** Postgres JSONB на MVP, миграция при росте.
2. **Yjs persistence.** Хранить полное состояние Yjs или только snapshot + операции? **Рекомендация:** snapshot каждые 100 операций + журнал, gc раз в сутки.
3. **AI direct-from-browser vs прокси.** Для каких провайдеров (OpenAI, Anthropic) делать direct call из браузера? Влияет на CSP и приватность. **Рекомендация:** прокси по умолчанию, direct по флагу пользователя для совместимых.
4. **Биллинг в SaaS:** платим ли мы за токены пользователя? **Рекомендация:** нет — BYOK строго; SaaS-подписка только за коллаборацию и облачное хранение.
5. **Лимиты бесплатного плана.** Количество проектов, размер, количество членов workspace. **Рекомендация:** 5 проектов, 100 узлов на проект, 1 участник в `Personal`.
6. **Совместимость десктоп ↔ web.** Двусторонняя синхронизация (десктоп ↔ облако) — отдельный проект на v1.5+ или нет вовсе?
7. **Каталог публичных шаблонов.** Модерация, лицензии, юридическая ответственность за чужой контент.
8. **Регион данных.** EU vs US vs RU. Влияет на инфраструктуру и compliance.
9. **Хранение чатов.** В `v0.0.6` — бессрочно по умолчанию; в web стоит ли вводить дефолтные TTL для экономии места?
10. **Yjs CRDT vs OT.** Реалистично ли поддерживать произвольное merge-поведение для бизнес-логики синхронизации 3 деревьев в Yjs?

### 20.2. Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|----------|
| Производительность канваса на больших картах | Средняя | Высокое | Раннее введение WebGL-рендера, бенчмарки на каждой PR |
| Сложность CRDT-логики для 3-tree sync | Высокая | Высокое | Прототип на ранней стадии, при необходимости — server-authoritative модель |
| BYOK + браузерные CORS-ограничения провайдеров | Средняя | Среднее | Прокси-режим по умолчанию |
| Стоимость инфраструктуры Cloud при росте | Средняя | Среднее | Cloud Native autoscale, лимиты на бесплатном плане |
| Принятие пользователями web-версии vs привычного десктопа | Средняя | Высокое | Lossless импорт `.sai`, общие хоткеи, parity UX |
| Безопасность хранения API-ключей | Низкая | Критическое | Audit + AES-256-GCM + master-key в KMS |
| Юридическая ответственность за публичные шаблоны | Низкая | Высокое | Модерация, DMCA-процесс, terms-of-service |
| Latency для удалённых регионов (одиночный регион Cloud) | Средняя | Среднее | CDN, edge-кэш статики, multi-region на v1.5 |
| Внезапные API breaking changes у LLM-провайдеров | Высокая | Среднее | Адаптеры провайдеров, контракт-тесты |

### 20.3. Зависимости от десктопной части

- Поддержка экспорта/импорта `.sai` обязана сохраняться синхронно. При изменении схемы в десктопе — coordinated release.
- Часть бизнес-сервисов (`SyncService`, `BridgeService`, `MutationService`, `TemplateService`) логически дублирует десктоп. Желательно вынести в общую `@sai/core` библиотеку (TS-порт) — но это отдельная инициатива и не блокирует MVP.

---

## Приложение A. Маппинг требований десктопа → web

| Десктоп (`v0.0.6`) | Web | Комментарий |
|--------------------|-----|-------------|
| F-001 / F-002 (3 дерева, режим работы) | F-120 / F-121 | без изменений |
| F-010 — F-014 (синхронизация) | F-123 — F-125 | + индикатор для всех клиентов |
| F-020 — F-023 (валидация узлов) | F-131 — F-135 | + история с источниками |
| F-030 — F-033 (мосты) | F-122 / F-141 | + visual diff |
| F-040 — F-045 (ИИ режимы) | F-150 — F-156 | + streaming + WebSocket |
| F-050 — F-055 (чаты) | F-150 — F-158 | + прикрепление файлов |
| F-060 — F-063 (экспорт/шаблоны) | F-180 — F-195 | + публичный share |
| F-064 — F-065 (usage) | F-200 — F-204 | + лимиты на workspace |
| F-070 — F-074 (recovery) | F-330 — F-333 + N-116 | + snapshots в Cloud |

---

## Приложение B. Хоткеи (полный список)

См. [§7.2](#72-hotkeys). Все хоткеи настраиваются в `Profile → Hotkeys` (SHOULD на MVP, MUST на v1).

---

## Приложение C. Глоссарий

| Термин | Определение |
|--------|-------------|
| **Project** | Контейнер с тремя деревьями, мостами и чатами |
| **Tree** | Одно из трёх: `Разработка` / `Функции` / `Бизнес` |
| **Node** | Узел дерева; имеет title, description, status, origin |
| **Edge** | Связь между узлами одного дерева |
| **Bridge (CrossTreeEdge)** | Связь между узлами разных деревьев |
| **Mind Map View** | Альтернативный режим отображения графа с фокусом на углубление |
| **Tree View** | Структурный режим (классический Sai) |
| **Expand** | Действие ИИ — сгенерировать N дочерних узлов |
| **Deepen** | Действие — открыть чат по контексту узла |
| **Snapshot** | Зафиксированная версия проекта для восстановления |
| **BYOK** | Bring Your Own Key — пользователь приносит свои API-ключи ИИ |
| **Workspace** | Тенант для группы пользователей с общими ресурсами |
| **CRDT** | Conflict-free Replicated Data Type — основа real-time co-edit |

---

> **Конец документа.**
>
> `sai_web v0.1.0` | 2026-06-13 | основано на `concept.md`, `sai_business_logic.md`, `sai_0_0_5.md`, `sai_0_0_6.md`
