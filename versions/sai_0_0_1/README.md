# Sai v0.0.1

ИИ-кофаундер и архитектор проектов. Нативное десктопное приложение на Python + PySide6.

## Установка

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Запуск

```bash
python main.py
```

## Структура проекта

```
sai/
├── main.py                 # Точка входа
├── requirements.txt
├── src/
│   ├── core/               # GraphEngine, models, FileStore
│   ├── services/           # LLMService, ExportService
│   ├── ui/                 # MainWindow, canvas, panels
│   │   ├── nodes/          # BoxNode, EdgePath, PortItem
│   │   └── widgets/        # MessageBubble, TreeWidget
│   └── utils/              # Config, constants, logger
└── resources/
    └── styles/catppuccin.qss
``` 

## Лицензия

Open Source (LGPL)
