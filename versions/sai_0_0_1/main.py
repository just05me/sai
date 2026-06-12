#!/usr/bin/env python3
"""Sai — ИИ-кофаундер и архитектор проектов.

Entry point. Run with:
    python main.py
"""

import sys
import os

# Ensure the project root is in the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.app import SaiApplication
from src.ui.main_window import MainWindow
from src.utils.logger import Logger


def main():
    app = SaiApplication(sys.argv)
    log = Logger.get()
    log.info("Starting Sai v0.0.1")

    window = MainWindow(app.config)
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
