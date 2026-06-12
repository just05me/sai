"""ProjectExplorer — left sidebar with files, nodes, and settings gear."""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QLabel, QPushButton, QTreeWidget, QTreeWidgetItem,
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont

from src.utils.constants import (
    MANTLE, TEXT, SUBTEXT0, SANTI, APP_VERSION,
    LIGHT_MANTLE, LIGHT_TEXT, LIGHT_SUBTEXT, LIGHT_SURFACE0, LIGHT_SURFACE1,
)

FONT_TITLE = QFont("Inter", 11, QFont.Bold)
FONT_ITEM = QFont("JetBrains Mono", 10)


class ProjectExplorer(QWidget):
    """Left panel: project files, nodes, chats, settings."""

    node_selected = Signal(str)
    chat_selected = Signal(str)
    settings_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumWidth(220)
        self._is_dark = True

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self._header_label = QLabel("  📁  Проект")
        self._header_label.setFont(FONT_TITLE)
        self._header_label.setFixedHeight(36)
        layout.addWidget(self._header_label)

        self._tree = QTreeWidget()
        self._tree.setHeaderHidden(True)
        self._tree.setIndentation(16)
        self._tree.itemClicked.connect(self._on_item_clicked)
        layout.addWidget(self._tree, 1)

        # Chats section label
        self._chats_header = QLabel("  💬  Чаты")
        self._chats_header.setFont(FONT_TITLE)
        self._chats_header.setFixedHeight(28)
        layout.addWidget(self._chats_header)

        self._chats_tree = QTreeWidget()
        self._chats_tree.setHeaderHidden(True)
        self._chats_tree.setMinimumHeight(140)
        self._chats_tree.setMaximumHeight(220)
        self._chats_tree.itemClicked.connect(self._on_chat_clicked)
        layout.addWidget(self._chats_tree)

        # Bottom: gear + version
        bottom = QWidget()
        bottom_layout = QVBoxLayout(bottom)
        bottom_layout.setContentsMargins(8, 4, 8, 8)

        self._settings_btn = QPushButton("⚙  Настройки API")
        self._settings_btn.setCursor(Qt.PointingHandCursor)
        self._settings_btn.clicked.connect(self.settings_requested.emit)
        bottom_layout.addWidget(self._settings_btn)

        version = QLabel(f"  Sai v{APP_VERSION}")
        version.setStyleSheet(f"color: {SUBTEXT0}; font-size: 10px;")
        bottom_layout.addWidget(version)
        layout.addWidget(bottom)

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
            hover = LIGHT_SURFACE0
        self.setStyleSheet(f"""
            ProjectExplorer {{
                background: {bg};
                color: {text};
            }}
            QLabel {{ color: {text}; background: {bg}; padding: 4px; }}
            QTreeWidget {{
                background: transparent;
                border: none;
                color: {text};
                font-size: 11px;
            }}
            QTreeWidget::item {{
                padding: 4px;
                border-radius: 6px;
                color: {text};
            }}
            QTreeWidget::item:hover {{ background: {hover}; }}
            QTreeWidget::item:selected {{ background: {SANTI}; color: white; }}
            QPushButton {{
                background: transparent;
                color: {text};
                border: 1px solid {border};
                border-radius: 6px;
                padding: 8px;
                text-align: left;
            }}
            QPushButton:hover {{ background: {hover}; border-color: {SANTI}; }}
        """)

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        self._apply_style()

    def set_project_files(self, files: list[dict]):
        self._tree.clear()
        for f in files:
            item = QTreeWidgetItem(self._tree)
            icon = "📁" if f["is_dir"] else "📄"
            item.setText(0, f"{icon}  {f['name']}")
            item.setData(0, Qt.UserRole, f["path"])

    def set_nodes(self, nodes: list):
        nodes_root = QTreeWidgetItem(self._tree)
        nodes_root.setText(0, "📋  Узлы")
        nodes_root.setExpanded(True)
        for node in nodes:
            item = QTreeWidgetItem(nodes_root)
            item.setText(0, f"  ●  {node.label[:30]}")
            item.setData(0, Qt.UserRole, f"node:{node.id}")

    def set_chats(self, chats: list[dict]):
        """chats: [{"id": "global", "label": "Global Brainstorm"}, ...]"""
        self._chats_tree.clear()
        for chat in chats:
            item = QTreeWidgetItem(self._chats_tree)
            item.setText(0, chat["label"])
            item.setData(0, Qt.UserRole, chat["id"])

    def _on_item_clicked(self, item, column):
        data = item.data(0, Qt.UserRole)
        if data and str(data).startswith("node:"):
            self.node_selected.emit(data)

    def _on_chat_clicked(self, item, column):
        chat_id = item.data(0, Qt.UserRole)
        if chat_id:
            self.chat_selected.emit(chat_id)
