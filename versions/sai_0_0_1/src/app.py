"""SaiApplication — app initialization and bootstrap."""

import sys
import os

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt
from PySide6.QtGui import QPalette, QColor

from src.utils.config import Config
from src.utils.logger import Logger
from src.utils.constants import APP_NAME, BASE, TEXT


class SaiApplication(QApplication):
    """Custom QApplication with Sai theming."""

    def __init__(self, argv):
        super().__init__(argv)

        self.setApplicationName(APP_NAME)
        self.setOrganizationName("Sai")
        self.setApplicationVersion("0.0.1")

        # Fusion style for consistent look across platforms
        self.setStyle("Fusion")

        # Dark palette
        palette = QPalette()
        palette.setColor(QPalette.Window, QColor(BASE))
        palette.setColor(QPalette.WindowText, QColor(TEXT))
        palette.setColor(QPalette.Base, QColor("#313244"))
        palette.setColor(QPalette.AlternateBase, QColor("#45475a"))
        palette.setColor(QPalette.ToolTipBase, QColor(TEXT))
        palette.setColor(QPalette.ToolTipText, QColor(TEXT))
        palette.setColor(QPalette.Text, QColor(TEXT))
        palette.setColor(QPalette.Button, QColor("#313244"))
        palette.setColor(QPalette.ButtonText, QColor(TEXT))
        palette.setColor(QPalette.BrightText, QColor("#cdd6f4"))
        palette.setColor(QPalette.Highlight, QColor("#89b4fa"))
        palette.setColor(QPalette.HighlightedText, QColor("#1e1e2e"))
        self.setPalette(palette)

        self.log = Logger.get()
        self.config = Config()

        # Load QSS
        self._load_stylesheet()

    def _load_stylesheet(self):
        """Load QSS from resources/styles/catppuccin.qss if available."""
        qss_path = os.path.join(
            os.path.dirname(__file__), "..",
            "resources", "styles", "catppuccin.qss"
        )
        if os.path.exists(qss_path):
            with open(qss_path) as f:
                self.setStyleSheet(f.read())
            self.log.info("QSS stylesheet loaded")
