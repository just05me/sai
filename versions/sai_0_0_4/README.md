# Sai v0.0.6

ИИ-кофаундер и архитектор проектов. Нативное десктопное приложение на Python + PySide6.

Актуализировано под ТЗ v0.0.6: 3 дерева, режимы ИИ `Вопросы/Агент`,
пошаговое подтверждение AI-мутаций, экспорт `PDF/Markdown/PNG`, шаблоны,
режим интерфейса `Редактор/Просмотр`, usage-экран и восстановление через snapshots.

## Установка

```bash
cd versions/sai_0_0_4
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
| Колёсико | Скролл по Y |
| Shift + колёсико | Скролл по X |
| Ctrl + колёсико | Зум |
| Ctrl+B | Focus Mode (скрыть панели) |
| Ctrl+L | Фокус на чат |

## Структура

```
sai_0_0_4/
├── main.py
├── requirements.txt
├── src/
│   ├── app.py
│   ├── core/           # GraphEngine, FileStore, models, command_stack
│   ├── services/       # LLMService, ExportService, TemplateService
│   ├── ui/
│   │   ├── main_window.py
│   │   ├── title_bar.py
│   │   ├── canvas.py
│   │   ├── chat_panel.py
│   │   ├── empty_state.py
│   │   ├── nodes/      # BoxNode, EdgePath (orthogonal)
│   │   ├── usage_dialog.py
│   │   └── widgets/    # message_stream, minimap, loading_indicator
│   └── utils/
└── resources/styles/   # catppuccin.qss, light.qss
```

## BYOK

API-ключ хранится локально в `~/.config/sai/config.json`.

## Лицензия

Open Source (LGPL)
