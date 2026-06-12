"""ChatPanel — Cursor-style flat stream chat with model selector."""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QTextEdit,
    QPushButton, QScrollArea, QComboBox, QFrame, QMenu, QToolButton,
)
from PySide6.QtCore import Qt, Signal, QTimer

from PySide6.QtGui import QFont

from src.ui.widgets.message_stream import MessageStream
from src.ui.widgets.loading_indicator import LoadingIndicator
from src.utils.constants import (
    MANTLE, SURFACE0, SURFACE1, TEXT, SUBTEXT0, SANTI,
    LIGHT_MANTLE, LIGHT_SURFACE0, LIGHT_TEXT, LIGHT_SURFACE1,
    AVAILABLE_MODELS, PROVIDERS,
)

FONT_MONO = QFont("JetBrains Mono", 10)


class ChatPanel(QWidget):
    """Right panel: flat AI chat stream."""

    message_sent = Signal(str, str)
    chat_mode_changed = Signal(str)
    clear_chat_requested = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._current_node_id = "global"
        self._current_label = "Global Brainstorm"
        self._messages: list[tuple] = []
        self._is_dark = True
        self._streaming_text = ""
        self._context_nodes: list = []
        self._token_count = 0
        self._chat_mode = "qa"
        self._mode_locked = False

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Model/Provider selector bar
        model_bar = QFrame()
        model_bar.setFixedHeight(36)
        model_layout = QHBoxLayout(model_bar)
        model_layout.setContentsMargins(8, 4, 8, 4)

        model_layout.addWidget(QLabel("Провайдер:"))
        self._provider_combo = QComboBox()
        for pk, info in PROVIDERS.items():
            self._provider_combo.addItem(info["name"], pk)
        self._provider_combo.setToolTip("Переключить AI провайдера")
        model_layout.addWidget(self._provider_combo)

        model_layout.addWidget(QLabel("Модель:"))
        self._model_combo = QComboBox()
        self._model_combo.addItems(AVAILABLE_MODELS)
        self._model_combo.setEditable(True)
        model_layout.addWidget(self._model_combo, 1)

        self._token_label = QLabel("")
        self._token_label.setStyleSheet(f"color: {SUBTEXT0}; font-size: 9px; padding: 0 4px;")
        model_layout.addWidget(self._token_label)

        layout.addWidget(model_bar)

        # Header
        header_row = QHBoxLayout()
        header_row.setContentsMargins(8, 0, 8, 0)
        header_row.setSpacing(6)

        self._header = QLabel("Global Brainstorm")
        self._header.setFont(QFont("JetBrains Mono", 11, QFont.Bold))
        self._header.setFixedHeight(32)
        header_row.addWidget(self._header, 1)

        self._mode_combo = QComboBox()
        self._mode_combo.addItem("Вопросы", "qa")
        self._mode_combo.addItem("Агент", "agent")
        self._mode_combo.setToolTip("Режим ИИ: текстовые ответы или предложения изменений")
        self._mode_combo.currentIndexChanged.connect(self._on_mode_changed)
        header_row.addWidget(self._mode_combo)

        self._clear_btn = QToolButton()
        self._clear_btn.setText("🧹")
        self._clear_btn.setToolTip("Очистить текущий чат")
        self._clear_btn.clicked.connect(self._on_clear_chat)
        header_row.addWidget(self._clear_btn)

        layout.addLayout(header_row)

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

    def set_chat_mode(self, mode: str):
        idx = self._mode_combo.findData(mode)
        if idx >= 0:
            self._mode_combo.blockSignals(True)
            self._mode_combo.setCurrentIndex(idx)
            self._mode_combo.blockSignals(False)
            self._chat_mode = mode

    def get_chat_mode(self) -> str:
        return self._chat_mode

    def set_mode_locked(self, locked: bool, forced_mode: str = "qa"):
        self._mode_locked = locked
        if locked:
            self.set_chat_mode(forced_mode)
        self._mode_combo.setEnabled(not locked)

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

    def set_provider(self, provider_key: str):
        idx = self._provider_combo.findData(provider_key)
        if idx >= 0:
            self._provider_combo.setCurrentIndex(idx)
            self._update_models_for_provider(provider_key)

    def get_provider(self) -> str:
        return self._provider_combo.currentData()

    def _update_models_for_provider(self, provider_key: str):
        provider = PROVIDERS.get(provider_key)
        if provider and provider["models"]:
            current = self._model_combo.currentText()
            self._model_combo.blockSignals(True)
            self._model_combo.clear()
            self._model_combo.addItems(provider["models"])
            idx = self._model_combo.findText(current)
            if idx >= 0:
                self._model_combo.setCurrentIndex(idx)
            else:
                self._model_combo.setCurrentIndex(0)
            self._model_combo.setEditable(True)
            self._model_combo.blockSignals(False)

    def update_token_count(self, count: int):
        self._token_count = count
        if count > 0:
            self._token_label.setText(f"🪙 {count}")
        else:
            self._token_label.setText("")

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
            QToolButton {{
                background: {surf};
                border: none;
                border-radius: 6px;
                padding: 4px 6px;
                color: {text};
            }}
            QToolButton:hover {{
                background: {SANTI};
                color: white;
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
        self._header.setText(f"{node_label[:40]}")
        self._clear_messages()

    def load_global_chat(self):
        self._current_node_id = "global"
        self._current_label = "Global Brainstorm"
        self._header.setText("Global Brainstorm")
        self._clear_messages()
        self.append_message("sai", "Global Brainstorm — опиши свою идею целиком.")

    def set_messages(self, messages: list[tuple[str, str]]):
        self._clear_messages()
        for role, text in messages:
            self.append_message(role, text)

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

    def _on_mode_changed(self):
        self._chat_mode = self._mode_combo.currentData()
        self.chat_mode_changed.emit(self._chat_mode)

    def _on_clear_chat(self):
        self.clear_chat_requested.emit(self._current_node_id)

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
