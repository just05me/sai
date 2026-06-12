# Sai — Технические задания (TOR)

[![Branch](https://img.shields.io/badge/branch-TOR-purple)](https://github.com/just05me/sai/tree/TOR) [![Format](https://img.shields.io/badge/format-Markdown-blue)](https://www.markdownguide.org) [![Status](https://img.shields.io/badge/status-active-success)](https://github.com/just05me/sai)

> Ветка с **техническими заданиями** (Terms of Reference) проекта Sai. Здесь собраны все ТЗ по версиям, концепция продукта и описание бизнес-логики.

---

## Зачем эта ветка?

Хранит **исходную постановку задачи** для каждой версии Sai отдельно от исходников. Когда нужно понять «что именно должна была делать версия 0.0.4» — смотрим сюда, а не в код.

- ✅ Чистая история эволюции требований
- ✅ Версионирование ТЗ синхронно с версиями кода
- ✅ Один источник правды для постановки задач ИИ-помощникам и команде

---

## Структура

```
ТЗ/
├── concept.md               # Общая концепция продукта
├── sai_business_logic.md    # Бизнес-логика и монетизация
├── sai_0_0_1.md             # ТЗ для версии 0.0.1
├── sai_0_0_2.md             # ТЗ для версии 0.0.2
├── sai_0_0_3.md             # ТЗ для версии 0.0.3
├── sai_0_0_4.md             # ТЗ для версии 0.0.4
├── sai_0_0_5.md             # ТЗ для версии 0.0.5
└── sai_0_0_6.md             # ТЗ для версии 0.0.6 (текущая)
```

---

## Содержание документов

| Документ | О чём |
|----------|-------|
| `concept.md` | Видение продукта: проблема, аудитория, ключевые принципы |
| `sai_business_logic.md` | Модель монетизации, BYOK, тарифы, расчёты |
| `sai_0_0_X.md` | Полное ТЗ конкретной версии: фичи, UX, технические требования, критерии готовности |

---

## Как пользоваться

```bash
git clone -b TOR https://github.com/just05me/sai.git sai-tor
cd sai-tor/ТЗ
ls *.md
```

Файлы — обычный Markdown, открываются в любом редакторе (VS Code, Obsidian, Typora, GitHub web UI).

---

## Связанные ветки

| Ветка | Содержимое |
|-------|------------|
| [`main`](https://github.com/just05me/sai/tree/main) | Основной README проекта |
| [`version`](https://github.com/just05me/sai/tree/version) | Исходный код всех версий (`versions/`) |
| [`claude_brain`](https://github.com/just05me/sai/tree/claude_brain) | Логи и контекст ИИ-сессий (`claude/`) |
| [`musor`](https://github.com/just05me/sai/tree/musor) | Черновики, скриншоты, сырые заметки (`AllOtherShit/`) |
| [`landing`](https://github.com/just05me/sai/tree/landing) | Лендинг продукта |

---

## Лицензия

Open Source — **LGPL**, как и основной проект.

---

<p align="center">Документы — то, с чего всё начиналось</p>
