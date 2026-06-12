"""SettingsDialog — API key, Base URL, and model configuration."""

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QLineEdit, QPushButton, QMessageBox,
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont

from src.utils.constants import (
    MANTLE, SURFACE0, SURFACE1, TEXT, SUBTEXT0,
    SUBTEXT1, BLUE, GREEN, RED,
)


class SettingsDialog(QDialog):
    """Configure LLM API connection (BYOK)."""

    def __init__(self, config, parent=None):
        super().__init__(parent)
        self._config = config
        self.setWindowTitle("Настройки Sai")
        self.setFixedSize(480, 320)
        self.setStyleSheet(f"""
            QDialog {{
                background: {MANTLE};
                color: {TEXT};
            }}
            QLabel {{
                color: {TEXT};
                font-size: 12px;
            }}
            QLineEdit {{
                background: {SURFACE0};
                border: 1px solid {SURFACE1};
                border-radius: 6px;
                padding: 8px;
                color: {TEXT};
                font-size: 12px;
            }}
            QLineEdit:focus {{
                border-color: {BLUE};
            }}
            QPushButton {{
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 12px;
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(20, 20, 20, 20)

        # Title
        title = QLabel("⚙️  Настройки API")
        title.setFont(QFont("sans-serif", 14, QFont.Bold))
        layout.addWidget(title)

        # API Key
        layout.addWidget(QLabel("API Key"))
        self._api_key = QLineEdit()
        self._api_key.setPlaceholderText("sk-...")
        self._api_key.setText(config.get("api_key", ""))
        self._api_key.setEchoMode(QLineEdit.Password)
        layout.addWidget(self._api_key)

        # Base URL
        layout.addWidget(QLabel("Base URL"))
        self._base_url = QLineEdit()
        self._base_url.setPlaceholderText("https://api.openai.com/v1")
        self._base_url.setText(config.get("base_url", "https://api.openai.com/v1"))
        layout.addWidget(self._base_url)

        # Model
        layout.addWidget(QLabel("Model"))
        self._model = QLineEdit()
        self._model.setPlaceholderText("gpt-4o, deepseek-chat, ...")
        self._model.setText(config.get("model", "gpt-4o"))
        layout.addWidget(self._model)

        # Buttons
        btn_layout = QHBoxLayout()

        test_btn = QPushButton("🔄  Test Connection")
        test_btn.setStyleSheet(f"""
            QPushButton {{
                background: {SURFACE1};
                color: {TEXT};
                border: 1px solid {SURFACE2};
            }}
            QPushButton:hover {{ background: {SURFACE2}; }}
        """)
        test_btn.clicked.connect(self._test_connection)
        btn_layout.addWidget(test_btn)

        btn_layout.addStretch()

        save_btn = QPushButton("💾  Сохранить")
        save_btn.setStyleSheet(f"""
            QPushButton {{
                background: {BLUE};
                color: {MANTLE};
                border: none;
                font-weight: bold;
            }}
            QPushButton:hover {{ background: #7aa2f7; }}
        """)
        save_btn.clicked.connect(self._save)
        btn_layout.addWidget(save_btn)

        cancel_btn = QPushButton("Отмена")
        cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background: transparent;
                color: {SUBTEXT0};
                border: 1px solid {SURFACE1};
            }}
            QPushButton:hover {{ background: {SURFACE0}; }}
        """)
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        layout.addLayout(btn_layout)

    def _save(self):
        self._config.set("api_key", self._api_key.text().strip())
        self._config.set("base_url", self._base_url.text().strip().rstrip("/"))
        self._config.set("model", self._model.text().strip())
        self.accept()

    def _test_connection(self):
        """Quick connectivity test (synchronous, for UI feedback)."""
        import httpx
        api_key = self._api_key.text().strip()
        base_url = self._base_url.text().strip().rstrip("/")
        model = self._model.text().strip()

        if not api_key:
            QMessageBox.warning(self, "Ошибка", "Введите API Key")
            return

        try:
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
                QMessageBox.information(self, "Успех", "✅ Подключение работает!")
            else:
                QMessageBox.warning(
                    self, "Ошибка",
                    f"❌ {resp.status_code}: {resp.text[:200]}"
                )
        except Exception as e:
            QMessageBox.warning(self, "Ошибка", f"❌ {str(e)}")
