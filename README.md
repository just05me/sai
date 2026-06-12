# Sai — Исходники по версиям (version)

[![Branch](https://img.shields.io/badge/branch-version-purple)](https://github.com/just05me/sai/tree/version) [![Versions](https://img.shields.io/badge/versions-0.0.1%20\u2192%200.0.4-blue)](https://github.com/just05me/sai/tree/version/versions) [![Python](https://img.shields.io/badge/Python-3.12+-green)](https://python.org) [![PySide6](https://img.shields.io/badge/PySide6-6.7+-darkgreen)](https://pypi.org/project/PySide6/)

> Ветка с **исходным кодом всех прототипов Sai**. Каждая версия живёт в собственной подпапке `versions/sai_0_0_X/` и полностью самодостаточна: свой `main.py`, свой `requirements.txt`, свой UI.

---

## Зачем эта ветка?

Сохраняет **эволюцию реализации** — можно вернуться к любому прототипу, увидеть, как менялась архитектура от 0.0.1 к 0.0.4, и запустить любую версию автономно.

- ✅ Каждая версия — отдельная папка, не зависит от других
- ✅ Можно сравнить две версии через `git diff` или `meld`
- ✅ Легко вытащить рабочий прототип для демо/презентации
- ✅ `.venv/` и кеши исключены из коммитов — только исходники

---

## Версии

| Версия | Что нового |
|--------|-----------|
| **0.0.1** | Базовый холст, узлы, связи, минимальный чат |
| **0.0.2** | Command stack (Undo/Redo), Empty state, Title bar, Minimap |
| **0.0.3** | Три дерева, экспорт ТЗ, диалоги (Confirm/Export), Light theme |
| **0.0.4** | Метрики, шаблоны, Cross-tree bridges, Usage dialog |

---

## Структура

```
versions/
├── sai_0_0_1/
│   ├── main.py
│   ├── requirements.txt
│   ├── README.md
│   └── src/
│       ├── core/        # GraphEngine, FileStore, models
│       ├── services/    # LLM, Export, Prompts
│       ├── ui/          # Canvas, Chat, Nodes, Widgets
│       └── utils/       # Config, constants, logger
├── sai_0_0_2/   # + command_stack, empty_state, title_bar
├── sai_0_0_3/   # + confirm_dialog, export_dialog
└── sai_0_0_4/   # + metrics_service, template_service, cross_tree_bridge, usage_dialog
```

---

## Как запустить любую версию

```bash
git clone -b version https://github.com/just05me/sai.git sai-versions
cd sai-versions/versions/sai_0_0_4

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python main.py
```

> Замените `sai_0_0_4` на любую другую версию — все они работают одинаково.

---

## Что НЕ попадает в коммиты

Чтобы ветка оставалась лёгкой, исключено:

- `.venv/` (виртуальные окружения — пересоздаются из `requirements.txt`)
- `__pycache__/`, `*.pyc` (кеши Python)
- `*.db`, `*.rvf*` (локальные runtime-артефакты)

См. `.gitignore` в корне репозитория на ветке `main`.

---

## Связанные ветки

| Ветка | Содержимое |
|-------|------------|
| [`main`](https://github.com/just05me/sai/tree/main) | Основной README проекта |
| [`TOR`](https://github.com/just05me/sai/tree/TOR) | Технические задания (`ТЗ/`) |
| [`claude_brain`](https://github.com/just05me/sai/tree/claude_brain) | Логи и контекст ИИ-сессий (`claude/`) |
| [`musor`](https://github.com/just05me/sai/tree/musor) | Черновики, скриншоты, сырые заметки (`AllOtherShit/`) |
| [`landing`](https://github.com/just05me/sai/tree/landing) | Лендинг продукта |

---

## Технологический стек (общий для всех версий)

| Компонент | Технология |
|-----------|-----------|
| Язык | Python 3.12+ |
| GUI | PySide6 (Qt for Python) |
| 2D-движок | QGraphicsScene / QGraphicsView |
| Асинхронность | QThreadPool + QRunnable |
| Стилизация | QSS (Catppuccin Mocha + Light) |
| ИИ | OpenAI / Anthropic / DeepSeek API |
| Данные | Pydantic v2 + JSON |

---

## Лицензия

Open Source — **LGPL**, как и основной проект.

---

<p align="center">История кода — от первой строки до текущего прототипа</p>
