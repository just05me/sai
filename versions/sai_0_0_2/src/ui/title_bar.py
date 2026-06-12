"""CustomTitleBar — frameless window title bar with theme and window controls."""

from PySide6.QtWidgets import QWidget, QHBoxLayout, QLabel, QPushButton, QSizePolicy
from PySide6.QtCore import Qt, Signal, QPoint
from PySide6.QtGui import QFont

from src.utils.constants import (
    MANTLE, TEXT, SUBTEXT0, SANTI,
    LIGHT_MANTLE, LIGHT_TEXT, LIGHT_SURFACE1,
)


class CustomTitleBar(QWidget):
    """Draggable title bar: menu, project name, theme toggle, window buttons."""

    theme_toggle_requested = Signal()
    minimize_requested = Signal()
    maximize_requested = Signal()
    close_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(40)
        self._drag_pos: QPoint | None = None
        self._is_dark = True

        layout = QHBoxLayout(self)
        layout.setContentsMargins(12, 0, 8, 0)
        layout.setSpacing(8)

        self._menu_btn = QPushButton("≡")
        self._menu_btn.setFixedSize(28, 28)
        self._menu_btn.setCursor(Qt.PointingHandCursor)
        layout.addWidget(self._menu_btn)

        self._title = QLabel("Sai")
        self._title.setFont(QFont("Inter", 11, QFont.Bold))
        layout.addWidget(self._title)

        layout.addStretch()

        self._theme_btn = QPushButton("🌙")
        self._theme_btn.setFixedSize(28, 28)
        self._theme_btn.setToolTip("Переключить тему")
        self._theme_btn.setCursor(Qt.PointingHandCursor)
        self._theme_btn.clicked.connect(self.theme_toggle_requested.emit)
        layout.addWidget(self._theme_btn)

        for symbol, slot in [("─", self.minimize_requested), ("□", self.maximize_requested), ("✕", self.close_requested)]:
            btn = QPushButton(symbol)
            btn.setFixedSize(28, 28)
            btn.setCursor(Qt.PointingHandCursor)
            btn.clicked.connect(slot.emit)
            if symbol == "✕":
                btn.setObjectName("closeBtn")
            layout.addWidget(btn)

        self._apply_style()

    def set_project_name(self, name: str):
        self._title.setText(name)

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        self._theme_btn.setText("🌙" if is_dark else "☀️")
        self._apply_style()

    def _apply_style(self):
        if self._is_dark:
            bg = MANTLE
            text = TEXT
            border = "#313244"
            hover = "#313244"
        else:
            bg = LIGHT_MANTLE
            text = LIGHT_TEXT
            border = LIGHT_SURFACE1
            hover = LIGHT_SURFACE1
        self.setStyleSheet(f"""
            CustomTitleBar {{
                background: {bg};
                border-bottom: 1px solid {border};
            }}
            QPushButton {{
                background: transparent;
                color: {text};
                border: none;
                border-radius: 6px;
                font-size: 13px;
            }}
            QPushButton:hover {{
                background: {hover};
            }}
            QPushButton#closeBtn:hover {{
                background: {SANTI};
                color: white;
            }}
            QLabel {{
                color: {text};
            }}
        """)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._drag_pos = event.globalPosition().toPoint()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self._drag_pos and event.buttons() & Qt.LeftButton:
            window = self.window()
            if window:
                delta = event.globalPosition().toPoint() - self._drag_pos
                window.move(window.pos() + delta)
                self._drag_pos = event.globalPosition().toPoint()
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        self._drag_pos = None
        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event):
        self.maximize_requested.emit()
        super().mouseDoubleClickEvent(event)
