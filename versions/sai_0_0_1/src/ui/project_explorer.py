"""ProjectExplorer — left sidebar panel for project navigation."""

from PySide6.QtWidgets import QDockWidget, QVBoxLayout, QWidget, QLabel, QPushButton
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont

from src.ui.widgets import ProjectTreeWidget
from src.utils.constants import MANTLE, TEXT, SURFACE2, SUBTEXT0

FONT_TITLE = QFont("sans-serif", 12, QFont.Bold)


class ProjectExplorer(QDockWidget):
    """Left panel: project files and node tree."""

    node_selected = Signal(str)

    def __init__(self, parent=None):
        super().__init__("Обозреватель", parent)
        self.setObjectName("ProjectExplorer")
        self.setFeatures(QDockWidget.DockWidgetMovable |
                         QDockWidget.DockWidgetClosable)
        self.setMinimumWidth(200)

        # Container
        container = QWidget()
        self.setWidget(container)

        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Header
        header = QLabel("  📁  Проект")
        header.setFont(FONT_TITLE)
        header.setStyleSheet(f"""
            background: {MANTLE};
            color: {TEXT};
            padding: 10px;
            font-size: 13px;
        """)
        header.setFixedHeight(40)
        layout.addWidget(header)

        # Tree widget
        self._tree = ProjectTreeWidget()
        self._tree.node_selected.connect(self.node_selected.emit)
        layout.addWidget(self._tree)

        # Bottom status
        status = QLabel("  💾  Sai v0.0.1")
        status.setStyleSheet(f"""
            background: {MANTLE};
            color: {SUBTEXT0};
            padding: 6px;
            font-size: 10px;
        """)
        status.setFixedHeight(26)
        layout.addWidget(status)

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

    def set_project_files(self, files: list[dict]):
        self._tree.set_project_files(files)

    def set_nodes(self, nodes: list):
        self._tree.set_nodes(nodes)
