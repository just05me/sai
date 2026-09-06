# Sai

[![Python](https://img.shields.io/badge/Python-3.12+-green)](https://python.org) [![PySide6](https://img.shields.io/badge/PySide6-6.7+-darkgreen)](https://pypi.org/project/PySide6/) [![Status](https://img.shields.io/badge/status-active-success)](https://github.com/just05me/sai)

Репозиторий проекта Sai: исходники прототипов, технические задания, лендинг, логи ИИ-сессий и черновики.

---

## Структура

```
.
├── versions/          # Исходный код прототипов (sai 0.0.1 → 0.0.4)
├── ТЗ/                # Технические задания по версиям, концепция, бизнес-логика
├── landing/           # Лендинг продукта
├── claude/            # Логи и контекст ИИ-сессий
└── AllOtherShit/      # Черновики, скриншоты, сырые заметки
```

---

## Версии исходников

Каждая версия живёт в собственной подпапке `versions/sai_0_0_X/` и полностью самодостаточна: свой `main.py`, свой `requirements.txt`, свой UI.

| Версия | Что нового |
|--------|-----------|
| **0.0.1** | Базовый холст, узлы, связи, минимальный чат |
| **0.0.2** | Command stack (Undo/Redo), Empty state, Title bar, Minimap |
| **0.0.3** | Три дерева, экспорт ТЗ, диалоги (Confirm/Export), Light theme |
| **0.0.4** | Метрики, шаблоны, Cross-tree bridges, Usage dialog |

### Как запустить любую версию

```bash
cd versions/sai_0_0_4

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python main.py
```

Замените `sai_0_0_4` на любую другую версию — все они работают одинаково.

---

## Технические задания

Папка `ТЗ/` хранит постановку задачи для каждой версии отдельно от исходников.

| Документ | О чём |
|----------|-------|
| `concept.md` | Видение продукта: проблема, аудитория, ключевые принципы |
| `sai_business_logic.md` | Модель монетизации, BYOK, тарифы, расчёты |
| `sai_0_0_X.md` | Полное ТЗ конкретной версии |

---

## Технологический стек

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

Open Source — **LGPL**.
