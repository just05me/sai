"""Sai constants — colors, sizes, type definitions."""

from uuid import uuid4

APP_NAME = "Sai"
APP_VERSION = "0.0.1"
FILE_VERSION = "0.0.1"

# === Catppuccin Mocha Palette ===
BASE = "#1e1e2e"
MANTLE = "#181825"
CRUST = "#11111b"
SURFACE0 = "#313244"
SURFACE1 = "#45475a"
SURFACE2 = "#585b70"
OVERLAY0 = "#6c7086"
OVERLAY1 = "#7f849c"
SUBTEXT0 = "#a6adc8"
SUBTEXT1 = "#bac2de"
TEXT = "#cdd6f4"
LAVENDER = "#b4befe"
BLUE = "#89b4fa"
GREEN = "#a6e3a1"
TEAL = "#94e2d5"
YELLOW = "#f9e2af"
PEACH = "#fab387"
MAROON = "#eba0ac"
RED = "#f38ba8"
MAUVE = "#cba6f7"
PINK = "#f5c2e7"
FLAMINGO = "#f2cdcd"
ROSEWATER = "#f5e0dc"

# === Node type → color mapping ===
NODE_COLORS = {
    "feature": GREEN,
    "module": TEAL,
    "question": PEACH,
    "task": BLUE,
    "milestone": MAUVE,
    "technology": LAVENDER,
    "actor": YELLOW,
    "action": PINK,
    "decision": MAROON,
    "note": OVERLAY0,
}

NODE_LABELS = {
    "feature": "Функция",
    "module": "Модуль",
    "question": "Вопрос",
    "task": "Задача",
    "milestone": "Веха",
    "technology": "Технология",
    "actor": "Участник",
    "action": "Действие",
    "decision": "Решение",
    "note": "Заметка",
}

NODE_TYPES_BY_TREE = {
    "functional": {"feature", "module", "question", "note"},
    "development": {"task", "milestone", "technology", "note"},
    "business": {"actor", "action", "decision", "note"},
}

TREE_NAMES = {
    "functional": "Дерево функционала",
    "development": "Дерево разработки",
    "business": "Дерево бизнес-логики",
}

# === Geometry ===
NODE_DEFAULT_WIDTH = 200
NODE_DEFAULT_HEIGHT = 80
NODE_CORNER_RADIUS = 10
PORT_RADIUS = 5
GRID_SIZE = 30
SCENE_SIZE = 10000

ZOOM_MIN = 0.1
ZOOM_MAX = 5.0
ZOOM_STEP = 1.15

# === Edge types ===
EDGE_TYPES = {
    "dependency": "зависит от",
    "parent": "содержит",
    "sequence": "следует за",
    "alternative": "альтернатива",
    "refinement": "уточняет",
    "trigger": "триггерит",
}


def generate_id() -> str:
    return str(uuid4())


def generate_edge_id() -> str:
    return "edge_" + uuid4().hex[:8]
