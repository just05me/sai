"""MessageStream — flat chat message (Cursor-style, no bubbles)."""

from PySide6.QtWidgets import QFrame, QVBoxLayout, QLabel
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

from src.utils.constants import (
    SURFACE0, TEXT, SANTI,
    LIGHT_SURFACE0, LIGHT_TEXT,
)


FONT_ROLE = QFont("JetBrains Mono", 9, QFont.Bold)
FONT_BODY = QFont("JetBrains Mono", 10)


class MessageStream(QFrame):
    """Single flat message block with divider."""

    def __init__(self, role: str, text: str, is_dark: bool = True, parent=None):
        super().__init__(parent)
        self.setObjectName("messageStream")
        self._role = role
        self._text = text
        self._is_dark = is_dark

        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 10, 12, 10)
        layout.setSpacing(4)

        role_label = "Вы" if role == "user" else "Sai"
        self._header = QLabel(role_label)
        self._header.setFont(FONT_ROLE)
        layout.addWidget(self._header)

        self._body = QLabel(text)
        self._body.setFont(FONT_BODY)
        self._body.setWordWrap(True)
        self._body.setTextInteractionFlags(
            Qt.TextSelectableByMouse | Qt.LinksAccessibleByMouse
        )
        self._body.setOpenExternalLinks(True)
        self._body.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        self._body.setMinimumHeight(20)
        layout.addWidget(self._body)

        self.setSizePolicy(self.sizePolicy().horizontalPolicy(),
                           self.sizePolicy().verticalPolicy())

        self._apply_theme()

    def append_text(self, extra: str):
        """Append text to the body (used for streaming)."""
        self._text += extra
        self._body.setText(self._text)

    def set_text(self, text: str):
        self._text = text
        self._body.setText(text)

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        self._apply_theme()

    def _apply_theme(self):
        is_dark = self._is_dark
        bg_user = "#262637" if is_dark else "#e8e8ef"
        bg_ai = SURFACE0 if is_dark else LIGHT_SURFACE0
        border = "#313244" if is_dark else "#d0d0da"
        text_color = TEXT if is_dark else LIGHT_TEXT
        bg = bg_user if self._role == "user" else bg_ai

        self.setStyleSheet(f"""
            #messageStream {{
                background: {bg};
                border: none;
                border-top: 1px solid {border};
            }}
            QLabel {{
                background: transparent;
                color: {text_color};
            }}
        """)
        header_color = SANTI if self._role == "sai" else text_color
        self._header.setStyleSheet(
            f"color: {header_color}; background: transparent;"
        )
        self._body.setStyleSheet(
            f"color: {text_color}; background: transparent;"
        )
