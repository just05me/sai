"""ProjectTreeWidget — file and node tree for the left sidebar."""

from PySide6.QtWidgets import QTreeWidget, QTreeWidgetItem
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont

from src.utils.constants import TEXT, SUBTEXT0, SURFACE0, SURFACE1

FONT_ITEM = QFont("sans-serif", 10)


class ProjectTreeWidget(QTreeWidget):
    """Tree view showing project files and nodes."""

    node_selected = Signal(str)  # node_id or file path

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setHeaderHidden(True)
        self.setIndentation(16)
        self.setAnimated(True)
        self.setStyleSheet(f"""
            QTreeWidget {{
                background: transparent;
                border: none;
                color: {TEXT};
                font-size: 12px;
                outline: none;
            }}
            QTreeWidget::item {{
                padding: 4px 0;
                border-radius: 4px;
            }}
            QTreeWidget::item:hover {{
                background: {SURFACE0};
            }}
            QTreeWidget::item:selected {{
                background: {SURFACE1};
            }}
        """)

        self.itemClicked.connect(self._on_item_clicked)

    def set_project_files(self, files: list[dict]):
        """Populate tree with project files and directories."""
        self.clear()
        for f in files:
            item = QTreeWidgetItem(self)
            icon = "📁" if f["is_dir"] else "📄"
            item.setText(0, f"{icon}  {f['name']}")
            item.setData(0, Qt.UserRole, f["path"])
            item.setFont(0, FONT_ITEM)

    def set_nodes(self, nodes: list):
        """Populate tree with nodes from the active tree."""
        root = self.findItems("Узлы", Qt.MatchStartsWith)
        nodes_root = None
        if not root:
            nodes_root = QTreeWidgetItem(self)
            nodes_root.setText(0, "📋  Узлы")
            nodes_root.setFont(0, FONT_ITEM)
        else:
            nodes_root = root[0]

        nodes_root.takeChildren()
        for node in nodes:
            item = QTreeWidgetItem(nodes_root)
            item.setText(0, f"  ●  {node.label[:30]}")
            item.setData(0, Qt.UserRole, f"node:{node.id}")
            item.setFont(0, FONT_ITEM)
        nodes_root.setExpanded(True)

    def _on_item_clicked(self, item, column):
        data = item.data(0, Qt.UserRole)
        if data:
            self.node_selected.emit(data)
