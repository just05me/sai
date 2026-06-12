# Sai v0.0.2

ИИ-кофаундер и архитектор проектов. Нативное десктопное приложение на Python + PySide6.

Реализует ТЗ v0.0.3: frameless-окно, dot grid, ортогональные связи, Cursor-style чат, BYOK, экспорт ТЗ.

## Установка

```bash
cd versions/sai_0_0_2
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Запуск

```bash
python main.py
```

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| Двойной клик на холсте | Создать узел |
| Space + перетаскивание | Pan |
| Ctrl+B | Focus Mode (скрыть панели) |
| Ctrl+L | Фокус на чат |

## Структура

```
sai_0_0_2/
├── main.py
├── requirements.txt
├── src/
│   ├── app.py
│   ├── core/           # GraphEngine, FileStore, models, command_stack
│   ├── services/       # LLMService, ExportService
│   ├── ui/
│   │   ├── main_window.py
│   │   ├── title_bar.py
│   │   ├── canvas.py
│   │   ├── chat_panel.py
│   │   ├── empty_state.py
│   │   ├── nodes/      # BoxNode, EdgePath (orthogonal)
│   │   └── widgets/    # message_stream, minimap, loading_indicator
│   └── utils/
└── resources/styles/   # catppuccin.qss, light.qss
```

## BYOK

API-ключ хранится локально в `~/.config/sai/config.json`.

## Лицензия

Open Source (LGPL)
