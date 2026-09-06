# Исходники Sai

Актуальный продукт — **Sai Web 1.0** в [`sai_0_0_5`](sai_0_0_5).

Каноническая постановка: [`ТЗ/sai.md`](../ТЗ/sai.md).

---

## Запуск

```bash
cd versions/sai_0_0_5
cp .env.example .env
npm install --legacy-peer-deps
docker compose up -d postgres   # или свой Postgres с pgvector
npx prisma migrate dev
npm run dev
```

Подробности — в [`sai_0_0_5/README.md`](sai_0_0_5/README.md).

---

## Changelog (сводный)

Формат — Keep a Changelog / SemVer. Детальный файл: [`sai_0_0_5/CHANGELOG.md`](sai_0_0_5/CHANGELOG.md).

### 1.0.0 — 2026-07-04

- Три дерева (DEV / FUNC / BIZ) на React Flow
- Чат по узлу, 5 персон, мутации с подтверждением
- BYOK AES-256-GCM, несколько провайдеров
- Экспорт MD / PDF / TXT / JSON / Mermaid
- Минимальный Docker: Postgres + pgvector, без Redis
- Локальный пользователь, command palette, Quick Capture, RU/EN

Ещё не в 1.0: sync трёх деревьев (1.1), Mind Map View (1.2), облачный auth.
