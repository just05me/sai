"""Application configuration — stores API key, last project path, etc."""

import json
import os

CONFIG_DIR = os.path.expanduser("~/.config/sai")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

DEFAULT_CONFIG = {
    "api_key": "",
    "base_url": "https://api.openai.com/v1",
    "model": "gpt-4o",
    "last_project": "",
    "theme": "dark",
    "window_geometry": None,
    "window_state": None,
    "focus_mode": False,
    "minimap_visible": True,
}


class Config:
    """Stores app-level settings (not project data)."""

    def __init__(self):
        self._data = dict(DEFAULT_CONFIG)
        self._ensure_dir()
        self._load()

    def _ensure_dir(self):
        os.makedirs(CONFIG_DIR, exist_ok=True)

    def _load(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    self._data.update(json.load(f))
            except (json.JSONDecodeError, OSError):
                pass

    def save(self):
        with open(CONFIG_FILE, "w") as f:
            json.dump(self._data, f, indent=2)

    def get(self, key: str, default=None):
        return self._data.get(key, default)

    def set(self, key: str, value):
        self._data[key] = value
        self.save()
