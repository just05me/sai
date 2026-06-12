"""ConfirmDialog — themed frameless modal confirmation dialog."""

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QFrame, QWidget,
)
from PySide6.QtCore import Qt, QPoint
from PySide6.QtGui import QFont

from src.utils.constants import (
    MANTLE, SURFACE0, SURFACE1, TEXT, SUBTEXT0, SANTI,
    LIGHT_MANTLE, LIGHT_TEXT, LIGHT_SUBTEXT, LIGHT_SURFACE0, LIGHT_SURFACE1,
)


FONT_TITLE = QFont("Inter", 12, QFont.Bold)
FONT_TEXT = QFont("Inter", 10)


class ConfirmDialog(QDialog):
    """Frameless themed Yes/No dialog matching the app style."""

    def __init__(
        self,
        title: str,
        message: str,
        confirm_text: str = "Удалить",
        cancel_text: str = "Отмена",
        icon: str = "⚠",
        danger: bool = True,
        parent=None,
    ):
        super().__init__(parent)
        self._is_dark = True
        if parent and hasattr(parent, "_is_dark"):
            self._is_dark = parent._is_dark
        else:
            window = parent.window() if parent else None
            if window and hasattr(window, "_is_dark"):
                self._is_dark = window._is_dark

        self._danger = danger
        self._drag_pos: QPoint | None = None

        self.setWindowTitle(title)
        self.setWindowFlags(Qt.Dialog | Qt.FramelessWindowHint)
        self.setModal(True)
        self.setFixedSize(420, 180)

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        self._frame = QFrame(self)
        self._frame.setObjectName("confirmFrame")
        outer.addWidget(self._frame)

        layout = QVBoxLayout(self._frame)
        layout.setContentsMargins(20, 18, 20, 18)
        layout.setSpacing(12)

        # Header (icon + title)
        header = QHBoxLayout()
        header.setSpacing(10)
        self._icon_label = QLabel(icon)
        self._icon_label.setFont(QFont("Inter", 18))
        header.addWidget(self._icon_label, 0, Qt.AlignTop)

        self._title_label = QLabel(title)
        self._title_label.setFont(FONT_TITLE)
        self._title_label.setWordWrap(True)
        header.addWidget(self._title_label, 1)
        layout.addLayout(header)

        # Message
        self._msg_label = QLabel(message)
        self._msg_label.setFont(FONT_TEXT)
        self._msg_label.setWordWrap(True)
        layout.addWidget(self._msg_label, 1)

        # Buttons
        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)
        btn_row.addStretch()

        self._cancel_btn = QPushButton(cancel_text)
        self._cancel_btn.setObjectName("cancelBtn")
        self._cancel_btn.setMinimumHeight(32)
        self._cancel_btn.setMinimumWidth(96)
        self._cancel_btn.setCursor(Qt.PointingHandCursor)
        self._cancel_btn.clicked.connect(self.reject)
        btn_row.addWidget(self._cancel_btn)

        self._confirm_btn = QPushButton(confirm_text)
        self._confirm_btn.setObjectName("confirmBtn")
        self._confirm_btn.setMinimumHeight(32)
        self._confirm_btn.setMinimumWidth(96)
        self._confirm_btn.setCursor(Qt.PointingHandCursor)
        self._confirm_btn.setDefault(True)
        self._confirm_btn.clicked.connect(self.accept)
        btn_row.addWidget(self._confirm_btn)

        layout.addLayout(btn_row)

        self._apply_style()

    def _apply_style(self):
        if self._is_dark:
            bg = MANTLE
            surf = SURFACE0
            border = SURFACE1
            text = TEXT
            subtext = SUBTEXT0
        else:
            bg = LIGHT_MANTLE
            surf = LIGHT_SURFACE0
            border = LIGHT_SURFACE1
            text = LIGHT_TEXT
            subtext = LIGHT_SUBTEXT

        danger = "#e64553" if self._danger else SANTI
        danger_hover = "#d13347" if self._danger else "#8a4066"

        self.setStyleSheet(f"""
            QDialog {{ background: transparent; }}
            #confirmFrame {{
                background: {bg};
                border: 1px solid {border};
                border-radius: 10px;
            }}
            QLabel {{
                color: {text};
                background: transparent;
            }}
            QPushButton#cancelBtn {{
                background: {surf};
                color: {text};
                border: 1px solid {border};
                border-radius: 6px;
                padding: 6px 16px;
            }}
            QPushButton#cancelBtn:hover {{
                background: {border};
            }}
            QPushButton#confirmBtn {{
                background: {danger};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 6px 16px;
                font-weight: bold;
            }}
            QPushButton#confirmBtn:hover {{
                background: {danger_hover};
            }}
        """)

    # --- Allow dragging the frameless dialog ---
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()
            return
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self._drag_pos and event.buttons() & Qt.LeftButton:
            self.move(event.globalPosition().toPoint() - self._drag_pos)
            event.accept()
            return
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        self._drag_pos = None
        super().mouseReleaseEvent(event)

    @staticmethod
    def ask(
        parent,
        title: str,
        message: str,
        confirm_text: str = "Удалить",
        cancel_text: str = "Отмена",
        icon: str = "⚠",
        danger: bool = True,
    ) -> bool:
        dlg = ConfirmDialog(
            title, message, confirm_text, cancel_text, icon, danger, parent,
        )
        return dlg.exec() == QDialog.Accepted
