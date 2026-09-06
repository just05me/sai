"""ChatPanel — right sidebar for AI chat (global and node-scoped)."""

from PySide6.QtWidgets import (
    QDockWidget, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QTextEdit, QPushButton, QScrollArea,
    QFrame, QSizePolicy,
)
from PySide6.QtCore import Qt, Signal, QTimer, QEvent
from PySide6.QtGui import QFont, QKeyEvent

from src.ui.widgets import MessageBubble, LoadingIndicator
from src.utils.constants import (
    MANTLE, SURFACE0, SURFACE1, TEXT, SUBTEXT0,
    SUBTEXT1, BLUE, GREEN,
)

FONT_HEADER = QFont("sans-serif", 12, QFont.Bold)
FONT_INPUT = QFont("sans-serif", 11)


class ChatPanel(QDockWidget):
    """Right panel: AI chat with global and node-scoped contexts."""

    message_sent = Signal(str, str)  # node_id (or "global"), message_text

    def __init__(self, parent=None):
        super().__init__("AI Чат", parent)
        self.setObjectName("ChatPanel")
        self.setFeatures(QDockWidget.DockWidgetMovable |
                         QDockWidget.DockWidgetClosable)
        self.setMinimumWidth(300)
        self.resize(350, 400)

        self._current_node_id = "global"
        self._messages = []

        # Container
        container = QWidget()
        self.setWidget(container)

        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Header
        self._header = QLabel("  💬  Global Brainstorm")
        self._header.setFont(FONT_HEADER)
        self._header.setStyleSheet(f"""
            background: {MANTLE};
            color: {TEXT};
            padding: 10px;
            font-size: 13px;
            border-bottom: 1px solid {SURFACE1};
        """)
        self._header.setFixedHeight(40)
        layout.addWidget(self._header)

        # Messages area (scroll)
        self._scroll_area = QScrollArea()
        self._scroll_area.setWidgetResizable(True)
        self._scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._scroll_area.setStyleSheet(f"""
            QScrollArea {{
                border: none;
                background: {SURFACE0};
            }}
            QScrollBar:vertical {{
                width: 4px;
                background: transparent;
            }}
            QScrollBar::handle:vertical {{
                background: {SUBTEXT0};
                border-radius: 2px;
                min-height: 20px;
            }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                height: 0;
            }}
        """)

        self._messages_container = QWidget()
        self._messages_layout = QVBoxLayout(self._messages_container)
        self._messages_layout.setContentsMargins(8, 8, 8, 8)
        self._messages_layout.setSpacing(8)
        self._messages_layout.addStretch()

        self._scroll_area.setWidget(self._messages_container)
        layout.addWidget(self._scroll_area)

        # Loading indicator
        self._loading = LoadingIndicator()
        self._loading.hide()
        layout.addWidget(self._loading)

        # Input area
        input_frame = QFrame()
        input_frame.setStyleSheet(f"""
            background: {MANTLE};
            border-top: 1px solid {SURFACE1};
        """)
        input_layout = QVBoxLayout(input_frame)
        input_layout.setContentsMargins(8, 8, 8, 8)
        input_layout.setSpacing(6)

        self._input = QTextEdit()
        self._input.setPlaceholderText("Напишите сообщение... (Enter — отправить, Shift+Enter — новая строка)")
        self._input.setFont(FONT_INPUT)
        self._input.setFixedHeight(60)
        self._input.setStyleSheet(f"""
            QTextEdit {{
                background: {SURFACE0};
                border: 1px solid {SURFACE1};
                border-radius: 8px;
                padding: 8px;
                color: {TEXT};
                font-size: 12px;
                selection-background-color: {SURFACE1};
            }}
            QTextEdit:focus {{
                border-color: {BLUE};
            }}
        """)
        self._input.installEventFilter(self)
        input_layout.addWidget(self._input)

        # Send button
        btn_layout = QHBoxLayout()
        btn_layout.setContentsMargins(0, 0, 0, 0)

        self._send_btn = QPushButton("→  Отправить")
        self._send_btn.setStyleSheet(f"""
            QPushButton {{
                background: {BLUE};
                color: {MANTLE};
                border: none;
                border-radius: 6px;
                padding: 6px 16px;
                font-size: 11px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background: #7aa2f7;
            }}
            QPushButton:pressed {{
                background: #6c8ed4;
            }}
        """)
        self._send_btn.clicked.connect(self._on_send)
        btn_layout.addStretch()
        btn_layout.addWidget(self._send_btn)
        input_layout.addLayout(btn_layout)

        layout.addWidget(input_frame)

        # Apply dock styling
        self.setStyleSheet(f"""
            QDockWidget {{
                background: {MANTLE};
                border: none;
                color: {TEXT};
            }}
            QDockWidget::title {{
                background: {MANTLE};
                padding: 6px;
                font-size: 11px;
            }}
        """)

        # Welcome message
        self.append_message("sai", "👋 Привет! Я Sai — твой ИИ-архитектор.\n\n"
                             "Опиши свою идею в глобальном чате, и я построю "
                             "функциональное дерево.\n\n"
                             "Или нажми на любой узел на холсте, чтобы "
                             "обсудить его детально.")

    def set_default_width(self, w: int):
        self.setMinimumWidth(w)

    def load_chat(self, node_id: str, node_label: str = "Узел"):
        """Switch to a node-specific chat context."""
        self._current_node_id = node_id
        self._header.setText(f"  💬  {node_label[:30]}")
        self._clear_messages()

    def load_global_chat(self):
        """Switch to the global brainstorm chat."""
        self._current_node_id = "global"
        self._header.setText("  💬  Global Brainstorm")
        self._clear_messages()
        self.append_message("sai", "👋 Global Brainstorm — опиши свою идею целиком.")

    def append_message(self, role: str, text: str, timestamp: str = ""):
        """Add a message to the chat display."""
        bubble = MessageBubble(role, text, timestamp)
        # Insert before the stretch
        self._messages_layout.insertWidget(
            self._messages_layout.count() - 1, bubble
        )
        self._messages.append((role, text, timestamp))
        # Auto-scroll to bottom
        QTimer.singleShot(50, self._scroll_to_bottom)

    def set_loading(self, active: bool):
        if active:
            self._loading.show()
        else:
            self._loading.stop()

    def clear_chat(self):
        self._clear_messages()

    def _clear_messages(self):
        while self._messages_layout.count() > 1:
            item = self._messages_layout.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()
        self._messages.clear()

    def _on_send(self):
        text = self._input.toPlainText().strip()
        if not text:
            return
        self._input.clear()
        self.append_message("user", text)
        self.message_sent.emit(self._current_node_id, text)

    def _scroll_to_bottom(self):
        scrollbar = self._scroll_area.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())

    def eventFilter(self, obj, event):
        """Handle Enter to send, Shift+Enter for newline."""
        if obj == self._input and event.type() == QEvent.Type.KeyPress and hasattr(event, 'key'):
            if event.key() == Qt.Key_Return and not event.modifiers() & Qt.ShiftModifier:
                self._on_send()
                return True
        return super().eventFilter(obj, event)
