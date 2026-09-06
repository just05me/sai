"""SaiApplication — app initialization, theming, QSS."""

import os

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
from PySide6.QtGui import QPalette, QColor

from src.utils.config import Config
from src.utils.logger import Logger
from src.utils.constants import (
    APP_NAME, APP_VERSION, BASE, MANTLE, TEXT, SURFACE0, SURFACE1,
    LIGHT_BASE, LIGHT_MANTLE, LIGHT_TEXT, LIGHT_SURFACE0,
)


class SaiApplication(QApplication):
    """Custom QApplication with dark/light theme support."""

    def __init__(self, argv):
        super().__init__(argv)
        self.setApplicationName(APP_NAME)
        self.setOrganizationName("Sai")
        self.setApplicationVersion(APP_VERSION)
        self.setStyle("Fusion")

        self.log = Logger.get()
        self.config = Config()
        self._is_dark = self.config.get("theme", "dark") == "dark"

        self._apply_palette()
        self._load_stylesheet()

    @property
    def is_dark(self) -> bool:
        return self._is_dark

    def toggle_theme(self):
        self._is_dark = not self._is_dark
        self.config.set("theme", "dark" if self._is_dark else "light")
        self._apply_palette()
        self._load_stylesheet()

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        self.config.set("theme", "dark" if is_dark else "light")
        self._apply_palette()
        self._load_stylesheet()

    def _apply_palette(self):
        palette = QPalette()
        if self._is_dark:
            palette.setColor(QPalette.Window, QColor(BASE))
            palette.setColor(QPalette.WindowText, QColor(TEXT))
            palette.setColor(QPalette.Base, QColor(SURFACE0))
            palette.setColor(QPalette.Text, QColor(TEXT))
            palette.setColor(QPalette.Button, QColor(SURFACE0))
            palette.setColor(QPalette.ButtonText, QColor(TEXT))
            palette.setColor(QPalette.Highlight, QColor("#743354"))
        else:
            palette.setColor(QPalette.Window, QColor(LIGHT_BASE))
            palette.setColor(QPalette.WindowText, QColor(LIGHT_TEXT))
            palette.setColor(QPalette.Base, QColor(LIGHT_SURFACE0))
            palette.setColor(QPalette.Text, QColor(LIGHT_TEXT))
            palette.setColor(QPalette.Button, QColor(LIGHT_MANTLE))
            palette.setColor(QPalette.ButtonText, QColor(LIGHT_TEXT))
            palette.setColor(QPalette.Highlight, QColor("#743354"))
        self.setPalette(palette)

    def _load_stylesheet(self):
        theme_file = "catppuccin.qss" if self._is_dark else "light.qss"
        qss_path = os.path.join(
            os.path.dirname(__file__), "..", "resources", "styles", theme_file
        )
        if os.path.exists(qss_path):
            with open(qss_path) as f:
                self.setStyleSheet(f.read())
            self.log.info(f"Theme loaded: {theme_file}")
