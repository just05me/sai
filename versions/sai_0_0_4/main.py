#!/usr/bin/env python3
"""Sai — ИИ-кофаундер и архитектор проектов."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.app import SaiApplication
from src.ui.main_window import MainWindow
from src.utils.logger import Logger
from src.utils.constants import APP_VERSION


def main():
    app = SaiApplication(sys.argv)
    Logger.get().info(f"Starting Sai v{APP_VERSION}")

    window = MainWindow(app.config, app)
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
