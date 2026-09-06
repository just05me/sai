# Sai

[![Status](https://img.shields.io/badge/status-1.0-success)](https://github.com/just05me/sai)
[![License: LGPL v3](https://img.shields.io/badge/license-LGPL--3.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6)](https://www.typescriptlang.org/)

ИИ-кофаундер и архитектор: из сырой идеи собирает три связанных дерева знаний — **Разработка / Функции / Бизнес**. Чат по узлу, BYOK, экспорт в Markdown.

Актуальный продукт — **веб-приложение 1.0**.

[Техническое задание](ТЗ/sai.md) · [Исходники](versions/sai_0_0_5) · [Changelog](versions/sai_0_0_5/CHANGELOG.md)

---

## Зачем

Sai забирает аналитическую работу на этапе «от идеи до структуры»: человек описывает замысел, вместе с ИИ раскладывает его на узлы и связи, затем выгружает документ. Код не пишет, людьми не управляет.

**Золотой путь 1.0:** создал проект → накидал узлы на трёх деревьях → поговорил с ИИ по узлу → выгрузил Markdown.

## Возможности

- Три дерева на одном канвасе (React Flow): DEV / FUNC / BIZ
- Чат по узлу и глобальный чат, пять персон ИИ
- Мутации графа только после Accept: Expand, Refactor, Bridge Suggest, Idea Score, Propose Tree
- BYOK: ключ шифруется в браузере (AES-256-GCM), провайдеры OpenAI / Anthropic / OpenRouter / DeepSeek / Ollama
- Экспорт Markdown, PDF, TXT, JSON, Mermaid
- Quick Capture: идея → каркас из девяти узлов
- Локальный пользователь, command palette, RU/EN, тёмная тема
- Self-host: Postgres + свой AI-ключ, без Redis

## Стек

| Слой | Технологии |
|------|------------|
| Приложение | Next.js 15, React 19, TypeScript, Tailwind |
| Канвас | React Flow 12 |
| API | tRPC, Prisma |
| Данные | PostgreSQL 16 + pgvector |
| ИИ | Vercel AI SDK, BYOK |

## Быстрый старт

Нужны Node.js 22+ и Docker (для Postgres).

```bash
git clone https://github.com/just05me/sai.git
cd sai/versions/sai_0_0_5
cp .env.example .env
# задайте AUTH_SECRET и BYOK_SERVER_SECRET:
#   openssl rand -base64 32
npm install --legacy-peer-deps
docker compose up -d postgres
npx prisma migrate dev
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Полный self-host одной командой:

```bash
cd versions/sai_0_0_5
cp .env.example .env
docker compose up -d
```

Подробности — в [README приложения](versions/sai_0_0_5/README.md).

## Репозиторий

```
.
├── README.md                 # этот файл
├── ТЗ/sai.md                 # каноническое ТЗ
└── versions/sai_0_0_5        # Sai Web 1.0
```

## Лицензия

[LGPL-3.0](LICENSE)
