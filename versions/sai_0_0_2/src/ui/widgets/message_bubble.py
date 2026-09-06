"""MessageBubble — a single chat message in the AI Chat panel."""

from PySide6.QtWidgets import QFrame, QVBoxLayout, QLabel, QTextBrowser
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

from src.utils.constants import SURFACE0, SURFACE1, TEXT, SUBTEXT0, GREEN, BLUE

FONT_SENDER = QFont("sans-serif", 9, QFont.Bold)
FONT_TIME = QFont("sans-serif", 8)
FONT_CONTENT = QFont("sans-serif", 11)
FONT_CONTENT_MONO = QFont("monospace", 10)


class MessageBubble(QFrame):
    """A styled chat bubble for user or AI messages."""

    def __init__(self, role: str, text: str, timestamp: str = "", parent=None):
        super().__init__(parent)
        self.setObjectName("messageBubble")

        is_user = role == "user"
        sender_name = "Вы" if is_user else "Sai"
        sender_color = BLUE if is_user else GREEN
        bg = SURFACE1 if is_user else SURFACE0
        self.setStyleSheet(f"""
            #messageBubble {{
                background-color: {bg};
                border-radius: 8px;
                padding: 4px;
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 6, 10, 6)
        layout.setSpacing(4)

        # Header
        header = QLabel(f"<b style='color:{sender_color}'>{sender_name}</b>"
                        f" <span style='color:{SUBTEXT0};font-size:9px'>{timestamp}</span>")
        header.setTextFormat(Qt.RichText)
        layout.addWidget(header)

        # Content
        browser = QTextBrowser()
        browser.setOpenExternalLinks(True)
        browser.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        browser.setHtml(f"<pre style='color:{TEXT};font-family:sans-serif;"
                        f"font-size:11px;margin:0;white-space:pre-wrap'>{text}</pre>")
        browser.setFixedHeight(browser.document().size().height() + 10)
        browser.setStyleSheet(f"background:transparent; border:none; color:{TEXT};")
        layout.addWidget(browser)
