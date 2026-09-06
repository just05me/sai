"""ChatPanel — Cursor-style flat stream chat with model selector."""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTextEdit,
    QPushButton, QScrollArea, QComboBox, QFrame, QMenu,
)
from PySide6.QtCore import Qt, Signal, QTimer

from PySide6.QtGui import QFont

from src.ui.widgets.message_stream import MessageStream
from src.ui.widgets.loading_indicator import LoadingIndicator
from src.utils.constants import (
    MANTLE, SURFACE0, SURFACE1, TEXT, SUBTEXT0, SANTI,
    LIGHT_MANTLE, LIGHT_SURFACE0, LIGHT_TEXT, LIGHT_SURFACE1,
    AVAILABLE_MODELS,
)

FONT_MONO = QFont("JetBrains Mono", 10)


class ChatPanel(QWidget):
    """Right panel: flat AI chat stream."""

    message_sent = Signal(str, str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._current_node_id = "global"
        self._current_label = "Global Brainstorm"
        self._messages: list[tuple] = []
        self._is_dark = True
        self._streaming_text = ""
        self._context_nodes: list = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Model selector bar
        model_bar = QFrame()
        model_bar.setFixedHeight(36)
        model_layout = QHBoxLayout(model_bar)
        model_layout.setContentsMargins(8, 4, 8, 4)

        model_layout.addWidget(QLabel("Модель:"))
        self._model_combo = QComboBox()
        self._model_combo.addItems(AVAILABLE_MODELS)
        self._model_combo.setEditable(True)
        model_layout.addWidget(self._model_combo, 1)
        layout.addWidget(model_bar)

        # Header
        self._header = QLabel("  Global Brainstorm")
        self._header.setFont(QFont("JetBrains Mono", 11, QFont.Bold))
        self._header.setFixedHeight(32)
        layout.addWidget(self._header)

        # Messages scroll
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)

        self._messages_widget = QWidget()
        self._messages_layout = QVBoxLayout(self._messages_widget)
        self._messages_layout.setContentsMargins(0, 0, 0, 0)
        self._messages_layout.setSpacing(0)
        self._messages_layout.addStretch()

        self._scroll.setWidget(self._messages_widget)
        layout.addWidget(self._scroll, 1)

        self._loading = LoadingIndicator()
        self._loading.hide()
        layout.addWidget(self._loading)

        # Input (border: none, auto-grow)
        input_frame = QFrame()
        input_layout = QVBoxLayout(input_frame)
        input_layout.setContentsMargins(8, 8, 8, 8)

        self._input = QTextEdit()
        self._input.setPlaceholderText("Введите сообщение… (@ — вставка контекста узла)")
        self._input.setFont(FONT_MONO)
        self._input.setMinimumHeight(40)
        self._input.setMaximumHeight(120)
        self._input.textChanged.connect(self._auto_grow_input)
        self._input.installEventFilter(self)
        input_layout.addWidget(self._input)

        self._send_btn = QPushButton("Отправить")
        self._send_btn.clicked.connect(self._on_send)
        input_layout.addWidget(self._send_btn)

        layout.addWidget(input_frame)

        self._apply_theme()
        self.append_message("sai",
            "Привет! Я Sai — твой ИИ-архитектор.\n"
            "Опиши идею продукта, и я помогу построить функциональное дерево.")

    def set_context_nodes(self, nodes: list):
        self._context_nodes = nodes

    def _show_context_menu(self):
        if not self._context_nodes:
            return
        menu = QMenu(self)
        for node in self._context_nodes:
            action = menu.addAction(f"@{node.label}")
            action.triggered.connect(
                lambda checked=False, lbl=node.label: self._insert_context(lbl)
            )
        menu.exec(self._input.mapToGlobal(self._input.rect().bottomLeft()))

    def _insert_context(self, label: str):
        cursor = self._input.textCursor()
        cursor.insertText(f"@{label} ")
        self._input.setTextCursor(cursor)

    def set_model(self, model_name: str):
        idx = self._model_combo.findText(model_name)
        if idx >= 0:
            self._model_combo.setCurrentIndex(idx)
        else:
            self._model_combo.setEditText(model_name)

    def get_model(self) -> str:
        return self._model_combo.currentText().strip()

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        self._apply_theme()
        for i in range(self._messages_layout.count()):
            w = self._messages_layout.itemAt(i).widget()
            if isinstance(w, MessageStream):
                w.set_dark_theme(is_dark)

    def _apply_theme(self):
        if self._is_dark:
            bg = MANTLE
            surf = SURFACE0
            text = TEXT
        else:
            bg = LIGHT_MANTLE
            surf = LIGHT_SURFACE0
            text = LIGHT_TEXT
        self.setStyleSheet(f"""
            ChatPanel, QFrame {{
                background: {bg};
                color: {text};
            }}
            QLabel {{ color: {text}; background: transparent; }}
            QComboBox {{
                background: {surf};
                border: none;
                border-radius: 6px;
                padding: 4px 8px;
                color: {text};
            }}
            QComboBox QAbstractItemView {{
                background: {surf};
                color: {text};
                selection-background-color: {SANTI};
                selection-color: white;
            }}
            QTextEdit {{
                background: {surf};
                border: none;
                border-radius: 6px;
                padding: 8px;
                color: {text};
            }}
            QPushButton {{
                background: {SANTI};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 6px 16px;
            }}
            QPushButton:hover {{ background: #8a4066; }}
            QScrollArea {{ border: none; background: {bg}; }}
        """)

    def load_chat(self, node_id: str, node_label: str = "Узел"):
        self._current_node_id = node_id
        self._current_label = node_label
        self._header.setText(f"  {node_label[:40]}")
        self._clear_messages()

    def load_global_chat(self):
        self._current_node_id = "global"
        self._current_label = "Global Brainstorm"
        self._header.setText("  Global Brainstorm")
        self._clear_messages()
        self.append_message("sai", "Global Brainstorm — опиши свою идею целиком.")

    def append_message(self, role: str, text: str):
        msg = MessageStream(role, text, self._is_dark)
        self._messages_layout.insertWidget(self._messages_layout.count() - 1, msg)
        self._messages.append((role, text))
        QTimer.singleShot(30, self._scroll_to_bottom)

    def set_loading(self, active: bool):
        if active:
            self._loading.start()
        else:
            self._loading.stop()

    def set_generating(self, text_so_far: str):
        self._streaming_text = text_so_far

    def append_stream_chunk(self, chunk: str):
        if not hasattr(self, "_stream_widget") or self._stream_widget is None:
            self._stream_buffer = chunk
            self._stream_widget = MessageStream("sai", chunk, self._is_dark)
            self._messages_layout.insertWidget(
                self._messages_layout.count() - 1, self._stream_widget
            )
        else:
            self._stream_buffer = getattr(self, "_stream_buffer", "") + chunk
            self._stream_widget.set_text(self._stream_buffer)
        QTimer.singleShot(10, self._scroll_to_bottom)

    def finish_stream(self):
        if self._stream_widget is not None:
            self._messages.append(("sai", self._stream_buffer))
        self._stream_widget = None
        self._stream_buffer = ""
        self._loading.stop()

    def finalize_response(self, response: str):
        """Called when LLM response is complete.

        If streaming was used, the stream widget already shows the text;
        we just register it. Otherwise, append a fresh message.
        """
        if getattr(self, "_stream_widget", None) is not None:
            # Use the streamed widget, replace its text with final response
            # in case of any drift between chunks and final.
            self._stream_widget.set_text(response)
            self._messages.append(("sai", response))
            self._stream_widget = None
            self._stream_buffer = ""
        else:
            self.append_message("sai", response)
        self._loading.stop()

    def _auto_grow_input(self):
        doc_h = self._input.document().size().height()
        h = min(max(40, int(doc_h) + 16), 120)
        self._input.setFixedHeight(h)

    def _on_send(self):
        text = self._input.toPlainText().strip()
        if not text:
            return
        self._input.clear()
        self.append_message("user", text)
        self.message_sent.emit(self._current_node_id, text)

    def _clear_messages(self):
        while self._messages_layout.count() > 1:
            item = self._messages_layout.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()
        self._messages.clear()
        self._stream_widget = None
        self._stream_buffer = ""

    def _scroll_to_bottom(self):
        sb = self._scroll.verticalScrollBar()
        sb.setValue(sb.maximum())

    def eventFilter(self, obj, event):
        if obj == self._input and event.type() == event.Type.KeyPress:
            if event.key() == Qt.Key_Return and not event.modifiers() & Qt.ShiftModifier:
                self._on_send()
                return True
            if event.key() == Qt.Key_At or event.text() == "@":
                QTimer.singleShot(0, self._show_context_menu)
                return False
        return super().eventFilter(obj, event)
