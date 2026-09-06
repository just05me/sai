"""SettingsDialog — provider-aware BYOK settings with auto-fill."""

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QLineEdit, QPushButton, QMessageBox, QComboBox, QWidget,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont

from src.utils.constants import (
    MANTLE, SURFACE0, SURFACE1, TEXT, SUBTEXT0, SANTI, PROVIDERS,
)


class DimOverlay(QWidget):
    """Semi-transparent overlay behind modal dialog."""

    clicked = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WA_TransparentForMouseEvents, False)
        self.setStyleSheet("background: rgba(0, 0, 0, 0.55);")

    def mousePressEvent(self, event):
        self.clicked.emit()
        super().mousePressEvent(event)


class SettingsDialog(QDialog):
    """Configure LLM provider and API connection (BYOK)."""

    def __init__(self, config, parent=None):
        super().__init__(parent)
        self._config = config
        self.setWindowTitle("Настройки API")
        self.setFixedSize(500, 400)
        self.setWindowFlags(Qt.Dialog | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground, False)

        self.setStyleSheet(f"""
            SettingsDialog {{
                background: {MANTLE};
                color: {TEXT};
                border: 1px solid {SURFACE1};
                border-radius: 8px;
            }}
            QLabel {{ color: {TEXT}; font-size: 12px; background: transparent; }}
            QLineEdit {{
                background: {SURFACE0};
                border: 1px solid {SURFACE1};
                border-radius: 6px;
                padding: 8px;
                color: {TEXT};
            }}
            QLineEdit:focus {{ border-color: {SANTI}; }}
            QComboBox {{
                background: {SURFACE0};
                border: 1px solid {SURFACE1};
                border-radius: 6px;
                padding: 8px;
                color: {TEXT};
                min-height: 20px;
            }}
            QComboBox::drop-down {{
                border: none;
                width: 24px;
            }}
            QComboBox QAbstractItemView {{
                background: {SURFACE0};
                color: {TEXT};
                selection-background-color: {SANTI};
                selection-color: white;
                border: 1px solid {SURFACE1};
            }}
            QPushButton {{
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 12px;
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setSpacing(10)
        layout.setContentsMargins(24, 20, 24, 20)

        title = QLabel("⚙  Настройки API (BYOK)")
        title.setFont(QFont("Inter", 14, QFont.Bold))
        layout.addWidget(title)

        # Provider selector
        layout.addWidget(QLabel("Провайдер"))
        self._provider = QComboBox()
        provider_keys = ["openai", "anthropic", "deepseek", "custom"]
        self._provider_keys = provider_keys
        for pk in provider_keys:
            self._provider.addItem(PROVIDERS[pk]["name"], pk)
        layout.addWidget(self._provider)

        # API Key
        layout.addWidget(QLabel("API Key"))
        self._api_key = QLineEdit()
        self._api_key.setPlaceholderText("sk-...")
        self._api_key.setText(config.get("api_key", ""))
        self._api_key.setEchoMode(QLineEdit.Password)
        layout.addWidget(self._api_key)

        # Base URL (auto-filled, but editable for Custom)
        layout.addWidget(QLabel("Base URL"))
        self._base_url = QLineEdit()
        layout.addWidget(self._base_url)

        # Model selector
        layout.addWidget(QLabel("Модель"))
        self._model = QComboBox()
        self._model.setEditable(True)
        layout.addWidget(self._model)

        layout.addStretch()

        # Buttons
        btn_layout = QHBoxLayout()

        test_btn = QPushButton("Test Connection")
        test_btn.setStyleSheet(
            f"background:{SURFACE1}; color:{TEXT}; border:1px solid {SURFACE1};"
        )
        test_btn.clicked.connect(self._test_connection)
        btn_layout.addWidget(test_btn)

        btn_layout.addStretch()

        save_btn = QPushButton("Сохранить")
        save_btn.setStyleSheet(
            f"background:{SANTI}; color:white; border:none; font-weight:bold;"
        )
        save_btn.clicked.connect(self._save)
        btn_layout.addWidget(save_btn)

        cancel_btn = QPushButton("Отмена")
        cancel_btn.setStyleSheet(
            f"background:transparent; color:{SUBTEXT0}; border:1px solid {SURFACE1};"
        )
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        layout.addLayout(btn_layout)

        # Restore saved state
        saved_provider = config.get("provider", "openai")
        idx = self._provider.findData(saved_provider)
        if idx >= 0:
            self._provider.setCurrentIndex(idx)
        self._on_provider_changed(idx if idx >= 0 else 0)

        self._provider.currentIndexChanged.connect(self._on_provider_changed)

        # Restore model after provider populates the list
        saved_model = config.get("model", "gpt-4o")
        midx = self._model.findText(saved_model)
        if midx >= 0:
            self._model.setCurrentIndex(midx)
        else:
            self._model.setEditText(saved_model)

        # Restore base URL (in case Custom with manual URL)
        saved_url = config.get("base_url", "")
        if saved_provider == "custom" and saved_url:
            self._base_url.setText(saved_url)

    def _on_provider_changed(self, idx):
        if idx < 0:
            return
        pk = self._provider_keys[idx]
        provider = PROVIDERS[pk]

        # Auto-fill base URL
        self._base_url.setText(provider["base_url"])
        self._base_url.setReadOnly(pk != "custom")

        # Update placeholder
        self._api_key.setPlaceholderText(provider["key_placeholder"])

        # Populate models
        self._model.clear()
        if provider["models"]:
            self._model.addItems(provider["models"])
            self._model.setCurrentIndex(0)
        self._model.setEditable(True)

    @staticmethod
    def show_modal(config, parent) -> bool:
        """Show dialog centered with dim overlay on parent."""
        overlay = DimOverlay(parent)
        overlay.setGeometry(parent.rect())
        overlay.show()
        overlay.raise_()

        dialog = SettingsDialog(config, parent)
        pg = parent.geometry()
        dialog.move(
            pg.x() + (pg.width() - dialog.width()) // 2,
            pg.y() + (pg.height() - dialog.height()) // 2,
        )
        overlay.clicked.connect(dialog.reject)
        result = dialog.exec()
        overlay.deleteLater()
        return result == QDialog.Accepted

    def _save(self):
        idx = self._provider.currentIndex()
        pk = self._provider_keys[idx] if idx >= 0 else "openai"
        self._config.set("provider", pk)
        self._config.set("api_type", PROVIDERS[pk]["api_type"])
        self._config.set("api_key", self._api_key.text().strip())
        self._config.set("base_url", self._base_url.text().strip().rstrip("/"))
        self._config.set("model", self._model.currentText().strip())
        self.accept()

    def _test_connection(self):
        import httpx

        api_key = self._api_key.text().strip()
        base_url = self._base_url.text().strip().rstrip("/")
        model = self._model.currentText().strip()
        idx = self._provider.currentIndex()
        pk = self._provider_keys[idx] if idx >= 0 else "openai"
        api_type = PROVIDERS[pk]["api_type"]

        if not api_key:
            QMessageBox.warning(self, "Ошибка", "Введите API Key")
            return

        try:
            if api_type == "anthropic":
                resp = httpx.post(
                    f"{base_url}/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 1,
                    },
                    timeout=10,
                )
            else:
                resp = httpx.post(
                    f"{base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 1,
                    },
                    timeout=10,
                )
            if resp.status_code == 200:
                QMessageBox.information(self, "Успех", "Подключение работает!")
            else:
                QMessageBox.warning(
                    self, "Ошибка",
                    f"{resp.status_code}: {resp.text[:200]}"
                )
        except Exception as e:
            QMessageBox.warning(self, "Ошибка", str(e))
