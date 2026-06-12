"""SettingsDialog — provider-aware BYOK settings with project controls."""

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QLineEdit, QPushButton, QMessageBox, QComboBox, QWidget,
    QCheckBox, QSpinBox, QTabWidget, QFrame,
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
    """Configure LLM provider, project defaults, and storage."""

    def __init__(self, config, project_settings=None, parent=None):
        super().__init__(parent)
        self._config = config
        self._project_settings = project_settings
        self.setWindowTitle("Настройки")
        self.setFixedSize(540, 520)
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
            QLineEdit, QSpinBox, QCheckBox {{
                background: {SURFACE0};
                border: 1px solid {SURFACE1};
                border-radius: 6px;
                padding: 8px;
                color: {TEXT};
            }}
            QLineEdit:focus {{ border-color: {SANTI}; }}
            QCheckBox::indicator {{
                width: 18px;
                height: 18px;
                border-radius: 4px;
                background: {SURFACE0};
                border: 1px solid {SURFACE1};
            }}
            QCheckBox::indicator:checked {{
                background: {SANTI};
                border-color: {SANTI};
            }}
            QComboBox {{
                background: {SURFACE0};
                border: 1px solid {SURFACE1};
                border-radius: 6px;
                padding: 8px;
                color: {TEXT};
                min-height: 20px;
            }}
            QComboBox::drop-down {{ border: none; width: 24px; }}
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
        layout.setSpacing(0)
        layout.setContentsMargins(0, 0, 0, 0)

        # Tab widget
        self._tabs = QTabWidget()
        self._tabs.addTab(self._build_provider_tab(), "🤖  AI Провайдер")
        self._tabs.addTab(self._build_project_tab(), "⚙  Проект")
        layout.addWidget(self._tabs, 1)

        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.setContentsMargins(24, 8, 24, 16)

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

        saved_model = config.get("model", "gpt-4o")
        midx = self._model.findText(saved_model)
        if midx >= 0:
            self._model.setCurrentIndex(midx)
        else:
            self._model.setEditText(saved_model)

        saved_url = config.get("base_url", "")
        if saved_provider == "custom" and saved_url:
            self._base_url.setText(saved_url)

        # Restore per-provider keys
        provider_keys = config.get("provider_keys", {})
        for pk, key in provider_keys.items():
            edit = getattr(self, f"_key_{pk}", None)
            if edit:
                edit.setText(key)

    # --- Provider tab ---

    def _build_provider_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(10)
        layout.setContentsMargins(24, 20, 24, 12)

        title = QLabel("Настройки API (BYOK)")
        title.setFont(QFont("Inter", 14, QFont.Bold))
        layout.addWidget(title)

        layout.addWidget(QLabel("Активный провайдер"))
        self._provider = QComboBox()
        self._provider_keys = ["openai", "anthropic", "deepseek", "custom"]
        for pk in self._provider_keys:
            self._provider.addItem(PROVIDERS[pk]["name"], pk)
        layout.addWidget(self._provider)

        layout.addWidget(QLabel("API Key (активный)"))
        self._api_key = QLineEdit()
        self._api_key.setPlaceholderText("sk-...")
        self._api_key.setText(self._config.get("api_key", ""))
        self._api_key.setEchoMode(QLineEdit.Password)
        layout.addWidget(self._api_key)

        # Per-provider keys (collapsible section)
        sep = QFrame()
        sep.setFrameShape(QFrame.HLine)
        sep.setStyleSheet(f"background:{SURFACE1}; max-height:1px;")
        layout.addWidget(sep)

        layout.addWidget(QLabel("Ключи для каждого провайдера (BYOK):"))
        for pk in ["openai", "anthropic", "deepseek"]:
            row = QHBoxLayout()
            row.setSpacing(8)
            lbl = QLabel(PROVIDERS[pk]["name"])
            lbl.setMinimumWidth(80)
            row.addWidget(lbl)
            edit = QLineEdit()
            edit.setPlaceholderText(PROVIDERS[pk]["key_placeholder"])
            edit.setEchoMode(QLineEdit.Password)
            edit.setText(self._config.get("provider_keys", {}).get(pk, ""))
            setattr(self, f"_key_{pk}", edit)
            row.addWidget(edit, 1)
            layout.addLayout(row)

        layout.addWidget(QLabel("Base URL"))
        self._base_url = QLineEdit()
        layout.addWidget(self._base_url)

        layout.addWidget(QLabel("Модель"))
        self._model = QComboBox()
        self._model.setEditable(True)
        layout.addWidget(self._model)

        layout.addStretch()
        return tab

    # --- Project tab ---

    def _build_project_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(10)
        layout.setContentsMargins(24, 20, 24, 12)

        title = QLabel("Настройки проекта")
        title.setFont(QFont("Inter", 14, QFont.Bold))
        layout.addWidget(title)

        ps = self._project_settings or {}

        self._autosave_cb = QCheckBox("Автосохранение")
        self._autosave_cb.setChecked(ps.get("autosave_enabled", True))
        layout.addWidget(self._autosave_cb)

        interval_row = QHBoxLayout()
        interval_row.addWidget(QLabel("Интервал автосохранения (сек):"))
        self._autosave_interval_spin = QSpinBox()
        self._autosave_interval_spin.setRange(5, 3600)
        self._autosave_interval_spin.setValue(ps.get("autosave_interval_sec", 60))
        self._autosave_interval_spin.setFixedWidth(90)
        interval_row.addWidget(self._autosave_interval_spin)
        interval_row.addStretch()
        layout.addLayout(interval_row)

        self._chat_keep_cb = QCheckBox("Хранить чаты бессрочно")
        self._chat_keep_cb.setChecked(ps.get("chat_keep_forever", True))
        layout.addWidget(self._chat_keep_cb)

        chat_mode_row = QHBoxLayout()
        chat_mode_row.addWidget(QLabel("Режим чата по умолчанию:"))
        self._default_chat_mode = QComboBox()
        self._default_chat_mode.addItem("Вопросы", "qa")
        self._default_chat_mode.addItem("Агент", "agent")
        default_mode = ps.get("default_chat_mode", "qa")
        mode_idx = self._default_chat_mode.findData(default_mode)
        if mode_idx >= 0:
            self._default_chat_mode.setCurrentIndex(mode_idx)
        chat_mode_row.addWidget(self._default_chat_mode)
        chat_mode_row.addStretch()
        layout.addLayout(chat_mode_row)

        ui_mode_row = QHBoxLayout()
        ui_mode_row.addWidget(QLabel("Режим интерфейса по умолчанию:"))
        self._ui_mode = QComboBox()
        self._ui_mode.addItem("Редактор", "editor")
        self._ui_mode.addItem("Просмотр", "view")
        ui_mode = ps.get("ui_mode", "editor")
        ui_mode_idx = self._ui_mode.findData(ui_mode)
        if ui_mode_idx >= 0:
            self._ui_mode.setCurrentIndex(ui_mode_idx)
        ui_mode_row.addWidget(self._ui_mode)
        ui_mode_row.addStretch()
        layout.addLayout(ui_mode_row)

        fmt_row = QHBoxLayout()
        fmt_row.addWidget(QLabel("Формат экспорта по умолчанию:"))
        self._export_fmt = QComboBox()
        self._export_fmt.addItem("Markdown", "markdown")
        self._export_fmt.addItem("PDF", "pdf")
        self._export_fmt.addItem("PNG", "png")
        default_fmt = ps.get("default_export_format", "markdown")
        idx = self._export_fmt.findData(default_fmt)
        if idx >= 0:
            self._export_fmt.setCurrentIndex(idx)
        fmt_row.addWidget(self._export_fmt)
        fmt_row.addStretch()
        layout.addLayout(fmt_row)

        layout.addStretch()

        info = QLabel(
            "Настройки проекта сохраняются в файле проекта.\n"
            "Настройки провайдера хранятся локально."
        )
        info.setStyleSheet(f"color: {SUBTEXT0}; font-size: 10px;")
        layout.addWidget(info)

        return tab

    # --- Provider switch logic ---

    def _on_provider_changed(self, idx):
        if idx < 0:
            return
        pk = self._provider_keys[idx]
        provider = PROVIDERS[pk]

        self._base_url.setText(provider["base_url"])
        self._base_url.setReadOnly(pk != "custom")

        self._api_key.setPlaceholderText(provider["key_placeholder"])

        self._model.clear()
        if provider["models"]:
            self._model.addItems(provider["models"])
            self._model.setCurrentIndex(0)
        self._model.setEditable(True)

    # --- Static show ---

    @staticmethod
    def show_modal(config, parent, project_settings=None) -> bool:
        """Show dialog centered with dim overlay on parent."""
        overlay = DimOverlay(parent)
        overlay.setGeometry(parent.rect())
        overlay.show()
        overlay.raise_()

        dialog = SettingsDialog(config, project_settings, parent)
        pg = parent.geometry()
        dialog.move(
            pg.x() + (pg.width() - dialog.width()) // 2,
            pg.y() + (pg.height() - dialog.height()) // 2,
        )
        overlay.clicked.connect(dialog.reject)
        result = dialog.exec()
        overlay.deleteLater()
        return result == QDialog.Accepted

    # --- Save ---

    def _save(self):
        idx = self._provider.currentIndex()
        pk = self._provider_keys[idx] if idx >= 0 else "openai"
        self._config.set("provider", pk)
        self._config.set("api_type", PROVIDERS[pk]["api_type"])
        self._config.set("api_key", self._api_key.text().strip())
        self._config.set("base_url", self._base_url.text().strip().rstrip("/"))
        self._config.set("model", self._model.currentText().strip())

        # Per-provider keys
        provider_keys = {}
        for pk_name in ["openai", "anthropic", "deepseek"]:
            edit = getattr(self, f"_key_{pk_name}", None)
            if edit:
                val = edit.text().strip()
                if val:
                    provider_keys[pk_name] = val
        self._config.set("provider_keys", provider_keys)

        # Project settings
        if self._project_settings is not None:
            self._project_settings["autosave_enabled"] = self._autosave_cb.isChecked()
            self._project_settings["autosave_interval_sec"] = self._autosave_interval_spin.value()
            self._project_settings["chat_keep_forever"] = self._chat_keep_cb.isChecked()
            self._project_settings["default_chat_mode"] = self._default_chat_mode.currentData()
            self._project_settings["ui_mode"] = self._ui_mode.currentData()
            self._project_settings["default_export_format"] = self._export_fmt.currentData()

        self.accept()

    # --- Test connection ---

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
