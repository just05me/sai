# Sai — ИИ-кофаундер и архитектор проектов

[![Version](https://img.shields.io/badge/version-0.0.3-purple)](https://github.com/rizobrain/sai) [![Python](https://img.shields.io/badge/Python-3.12+-blue)](https://python.org) [![PySide6](https://img.shields.io/badge/PySide6-6.7+-green)](https://pypi.org/project/PySide6/) [![License](https://img.shields.io/badge/license-LGPL-red)](LICENSE) [![Platform](https://img.shields.io/badge/platform-Linux-important)](https://ubuntu.com)

> Превращает сырые идеи в визуальную архитектуру продукта. Бесконечный холст, ИИ-чат, три дерева: функционал, разработка, бизнес-логика.

---

## Зачем Sai?

### ❌ Без Sai

Идеи остаются в хаосе головы, заметок и скриншотов. Нет структуры, нет декомпозиции, нет документации:

- ❌ Идеи тонут в бесконечных чатах и файлах
- ❌ Нет связи между функционалом, архитектурой и бизнес-логикой
- ❌ ТЗ пишется вручную, устаревает до завершения
- ❌ ИИ-помощники не видят контекста проекта

### ✅ С Sai

Структурированная визуальная архитектура с ИИ-ассистентом, который помнит контекст:

```txt
Спроектируй систему оплаты с подписками и триалами
```
→ ИИ строит дерево функций, user journey и архитектурный план

```txt
Разбей авторизацию на подзадачи
```
→ ИИ декомпозирует узел с сохранением связей

```txt
Сгенерируй ТЗ по текущему дереву
```
→ Готовый Markdown-документ с выбранными узлами

---

## Возможности

| | Возможность | Описание |
|--|-------------|---------|
| 🎨 | **Бесконечный холст** | Dot grid, зум под курсором, панорамирование MMB/Space |
| 🧩 | **Узлы и связи** | 10 типов узлов, ортогональные линии Manhattan routing, 4 статуса |
| 🌳 | **Три дерева** | Функционал / Разработка / Бизнес-логика — независимые, с ручной синхронизацией |
| 🤖 | **ИИ-чат** | Cursor-style flat stream, контекстные чаты по узлам, брейншторм → граф |
| 🔑 | **BYOK** | OpenAI, Anthropic, DeepSeek, Custom — свой ключ, любой провайдер |
| ↩️ | **Undo/Redo** | Полный стек операций (30 шагов) |
| 📄 | **Экспорт ТЗ** | Markdown с выбором деревьев и узлов |
| 🖼 | **Экспорт PNG** | Рендер холста в изображение |
| 🔍 | **Поиск** | Ctrl+F по узлам всех деревьев |
| 🎯 | **Snap to grid** | 24px, автоматическое выравнивание |
| 🌙 | **Тёмная/светлая тема** | Catppuccin Mocha + Light |
| ⌨️ | **Горячие клавиши** | Полный набор |

---

## Установка

```bash
# Клонировать
git clone https://github.com/rizobrain/sai.git
cd sai/versions/sai_0_0_3

# Виртуальное окружение
python3 -m venv .venv
source .venv/bin/activate

# Зависимости
pip install -r requirements.txt

# Запуск
python main.py
```

---

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Double-click` холст | Создать узел |
| `Space` + перетаскивание | Pan |
| `MMB` + перетаскивание | Pan |
| `Scroll` | Зум под курсором |
| `Delete` / `Backspace` | Удалить выбранное |
| `Ctrl+A` | Выбрать все узлы |
| `Ctrl+D` | Дублировать узел |
| `Ctrl+C` / `Ctrl+V` | Копировать / вставить узлы |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+F` | Поиск узлов |
| `Ctrl+B` | Focus Mode |
| `Ctrl+L` | Фокус на чат |
| `G` | Показать/скрыть сетку |
| `F` | Zoom to fit выделенного |
| `Escape` | Сбросить выделение |

---

## Структура проекта

```
sai/
├── main.py                         # Точка входа
├── requirements.txt
├── versions/
│   ├── sai_0_0_1/                  # Прототип 1
│   ├── sai_0_0_2/                  # Прототип 2
│   └── sai_0_0_3/                  # Текущая версия
│       ├── main.py
│       └── src/
│           ├── core/               # GraphEngine, FileStore, models
│           ├── services/           # LLMService, ExportService
│           ├── ui/
│           │   ├── canvas.py       # InfiniteCanvas + CanvasScene
│           │   ├── chat_panel.py   # Cursor-style чат
│           │   ├── nodes/          # BoxNode, EdgePath, PortItem
│           │   └── widgets/        # Minimap, SearchBar, LoadingIndicator
│           └── utils/              # Config, constants, logger
├── ТЗ/                             # Технические задания
└── claude/                         # Документация ИИ-сессий
```

---

## Скриншоты

> *(добавьте скриншоты интерфейса)*

| Холст | Чат с ИИ | Экспорт |
|-------|---------|---------|
| ![Canvas](https://via.placeholder.com/400x250/1e1e2e/cdd6f4?text=Canvas) | ![Chat](https://via.placeholder.com/400x250/1e1e2e/cdd6f4?text=AI+Chat) | ![Export](https://via.placeholder.com/400x250/1e1e2e/cdd6f4?text=Export) |

---

## Технологический стек

| Компонент | Технология |
|-----------|-----------|
| Язык | Python 3.12+ |
| GUI | PySide6 (Qt for Python) |
| 2D-движок | QGraphicsScene / QGraphicsView |
| Архитектура | Scene Graph + Signals/Slots |
| Асинхронность | QThreadPool + QRunnable |
| Стилизация | QSS (Catppuccin) |
| ИИ | OpenAI / Anthropic / DeepSeek API |
| Данные | Pydantic v2 + JSON |

---

## Лицензия

Open Source — **LGPL**. Свободно используйте, модифицируйте и распространяйте.

---

## Sai в медиа

> Следите за обновлениями: проект в активной разработке.

[![X](https://img.shields.io/badge/follow-%40rizobrain-black)](https://x.com/rizobrain)

---

<p align="center">Сделано с ❤️ для соло-фаундеров, вайбкодеров и инженеров</p>
