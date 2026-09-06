"""Sai constants — colors, sizes, type definitions."""

from uuid import uuid4

APP_NAME = "Sai"
APP_VERSION = "0.0.6"
FILE_VERSION = "0.0.6"
SCHEMA_VERSION = "0.0.6"

# Brand accent
SANTI = "#743354"

# === Dark theme (Catppuccin Mocha) ===
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

# === Light theme ===
LIGHT_BASE = "#f4f4f7"
LIGHT_MANTLE = "#ffffff"
LIGHT_SURFACE0 = "#e2e2e9"
LIGHT_SURFACE1 = "#d0d0da"
LIGHT_TEXT = "#4c4f69"
LIGHT_SUBTEXT = "#6c6f85"

# Grid dot colors
GRID_DOT_DARK = "#313244"
GRID_DOT_LIGHT = "#e2e2e9"

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

AVAILABLE_MODELS = [
    "gpt-4o",
    "gpt-4o-mini",
    "deepseek-chat",
    "claude-sonnet-4-6",
]

# === AI Providers ===
PROVIDERS = {
    "openai": {
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o3-mini", "o4-mini"],
        "key_placeholder": "sk-...",
        "api_type": "openai",
    },
    "anthropic": {
        "name": "Anthropic",
        "base_url": "https://api.anthropic.com/v1",
        "models": ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"],
        "key_placeholder": "sk-ant-...",
        "api_type": "anthropic",
    },
    "deepseek": {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "key_placeholder": "sk-...",
        "api_type": "openai",
    },
    "custom": {
        "name": "Custom",
        "base_url": "",
        "models": [],
        "key_placeholder": "API Key",
        "api_type": "openai",
    },
}

# === Geometry ===
NODE_DEFAULT_WIDTH = 200
NODE_DEFAULT_HEIGHT = 80
NODE_CORNER_RADIUS = 8
PORT_RADIUS = 8
GRID_SIZE = 24
SCENE_SIZE = 10000

ZOOM_MIN = 0.1
ZOOM_MAX = 5.0
ZOOM_STEP = 1.15

EDGE_HITBOX = 6

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
