"""MainWindow — the main application window combining all three panels."""

from PySide6.QtWidgets import (
    QMainWindow, QToolBar, QWidget, QHBoxLayout, QLabel,
    QFileDialog, QMessageBox, QPushButton, QComboBox,
    QSizePolicy, QApplication,
)
from PySide6.QtCore import Qt, QTimer, Signal, QSize
from PySide6.QtGui import QAction, QFont

from src.core import GraphEngine, FileStore
from src.ui.canvas import InfiniteCanvas, CanvasScene
from src.ui.chat_panel import ChatPanel
from src.ui.project_explorer import ProjectExplorer
from src.ui.settings_dialog import SettingsDialog
from src.ui.nodes import BoxNode, EdgePath
from src.utils.constants import (
    MANTLE, SURFACE0, SURFACE1, TEXT, SUBTEXT0,
    SUBTEXT1, BLUE, GREEN, TREE_NAMES, NODE_TYPES_BY_TREE,
    NODE_LABELS, NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT,
)
from src.utils.config import Config
from src.utils.logger import Logger

FONT_TOOLBAR = QFont("sans-serif", 11)


class MainWindow(QMainWindow):
    """Three-panel Sai main window."""

    def __init__(self, config: Config):
        super().__init__()
        self._config = config
        self.log = Logger.get()

        # Core
        self._engine = GraphEngine(self)
        self._file_store = FileStore()
        self._current_project_path = ""

        # UI
        self._setup_window()
        self._setup_canvas()
        self._setup_panels()
        self._setup_toolbar()
        self._setup_menu()
        self._setup_signals()

        # Restore last project or create new
        self._engine.new_project("Новый проект")
        self._update_title()

        # Auto-save timer (debounce)
        self._save_timer = QTimer(self)
        self._save_timer.setSingleShot(True)
        self._save_timer.timeout.connect(self._autosave)
        self.log.info("MainWindow initialized")

    def _setup_window(self):
        self.setWindowTitle("Sai — ИИ-архитектор проектов")
        self.resize(1400, 900)
        self.setStyleSheet(f"""
            QMainWindow {{
                background-color: {MANTLE};
            }}
        """)

        # Restore geometry if available
        geo = self._config.get("window_geometry")
        if geo:
            self.restoreGeometry(bytes(geo))
        state = self._config.get("window_state")
        if state:
            self.restoreState(bytes(state))

    def _setup_canvas(self):
        self._scene = CanvasScene(self)
        self._canvas = InfiniteCanvas(self._scene, self)
        self.setCentralWidget(self._canvas)

    def _setup_panels(self):
        # Left: Project Explorer
        self._explorer = ProjectExplorer(self)
        self.addDockWidget(Qt.LeftDockWidgetArea, self._explorer)

        # Right: Chat Panel
        self._chat = ChatPanel(self)
        self.addDockWidget(Qt.RightDockWidgetArea, self._chat)

    def _setup_toolbar(self):
        toolbar = QToolBar("Инструменты")
        toolbar.setMovable(False)
        toolbar.setStyleSheet(f"""
            QToolBar {{
                background: {MANTLE};
                border-bottom: 1px solid {SURFACE1};
                spacing: 6px;
                padding: 4px 8px;
            }}
            QToolButton {{
                color: {TEXT};
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 11px;
            }}
            QToolButton:hover {{
                background: {SURFACE0};
            }}
        """)
        toolbar.setIconSize(QSize(16, 16))

        # Tree switcher
        self._tree_switcher = QComboBox()
        self._tree_switcher.addItem("🌳  Дерево функционала", "functional")
        self._tree_switcher.addItem("🛠  Дерево разработки", "development")
        self._tree_switcher.addItem("👤  Дерево бизнес-логики", "business")
        self._tree_switcher.currentIndexChanged.connect(self._on_tree_switch)
        self._tree_switcher.setStyleSheet(f"""
            QComboBox {{
                background: {SURFACE0};
                color: {TEXT};
                border: 1px solid {SURFACE1};
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 11px;
            }}
            QComboBox::drop-down {{
                border: none;
            }}
            QComboBox QAbstractItemView {{
                background: {MANTLE};
                color: {TEXT};
                selection-background-color: {SURFACE1};
            }}
        """)
        toolbar.addWidget(self._tree_switcher)
        toolbar.addSeparator()

        # New node button
        new_node_btn = QPushButton("+  Узел")
        new_node_btn.setStyleSheet(f"""
            QPushButton {{
                background: {BLUE};
                color: {MANTLE};
                border: none;
                border-radius: 6px;
                padding: 4px 12px;
                font-size: 11px;
                font-weight: bold;
            }}
            QPushButton:hover {{ background: #7aa2f7; }}
        """)
        new_node_btn.clicked.connect(self._on_add_node)
        toolbar.addWidget(new_node_btn)

        # Spacer
        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        toolbar.addWidget(spacer)

        # Export button
        export_btn = QPushButton("📄  Экспорт ТЗ")
        export_btn.setStyleSheet(f"""
            QPushButton {{
                background: {GREEN};
                color: {MANTLE};
                border: none;
                border-radius: 6px;
                padding: 4px 12px;
                font-size: 11px;
                font-weight: bold;
            }}
            QPushButton:hover {{ background: #9ece9a; }}
        """)
        export_btn.clicked.connect(self._on_export)
        toolbar.addWidget(export_btn)

        self.addToolBar(toolbar)

    def _setup_menu(self):
        menubar = self.menuBar()
        menubar.setStyleSheet(f"""
            QMenuBar {{
                background: {MANTLE};
                color: {TEXT};
                border-bottom: 1px solid {SURFACE1};
                font-size: 11px;
            }}
            QMenuBar::item:selected {{
                background: {SURFACE0};
            }}
            QMenu {{
                background: {MANTLE};
                color: {TEXT};
                border: 1px solid {SURFACE1};
            }}
            QMenu::item:selected {{
                background: {SURFACE0};
            }}
            QMenu::separator {{
                background: {SURFACE1};
                height: 1px;
            }}
        """)

        # File menu
        file_menu = menubar.addMenu("Файл")

        new_action = QAction("Новый проект", self)
        new_action.triggered.connect(self._on_new_project)
        file_menu.addAction(new_action)

        open_action = QAction("Открыть проект...", self)
        open_action.triggered.connect(self._on_open_project)
        file_menu.addAction(open_action)

        save_action = QAction("Сохранить", self)
        save_action.triggered.connect(self._on_save)
        file_menu.addAction(save_action)

        file_menu.addSeparator()

        quit_action = QAction("Выход", self)
        quit_action.triggered.connect(self.close)
        file_menu.addAction(quit_action)

        # Settings menu
        settings_menu = menubar.addMenu("Настройки")

        api_action = QAction("API подключение...", self)
        api_action.triggered.connect(self._on_settings)
        settings_menu.addAction(api_action)

        # Help menu
        help_menu = menubar.addMenu("Помощь")
        about_action = QAction("О Sai", self)
        about_action.triggered.connect(self._on_about)
        help_menu.addAction(about_action)

    def _setup_signals(self):
        # Canvas signals
        self._canvas.node_create_requested.connect(self._on_node_create_request)
        self._canvas.edge_create_requested.connect(self._on_edge_create_request)

        # Engine signals
        self._engine.node_added.connect(self._on_node_added)
        self._engine.node_removed.connect(self._on_node_removed)
        self._engine.edge_added.connect(self._on_edge_added)
        self._engine.node_moved.connect(self._on_node_moved)
        self._engine.tree_switched.connect(self._on_tree_switched_by_engine)

        # Chat signals
        self._chat.message_sent.connect(self._on_chat_message)

        # Explorer signals
        self._explorer.node_selected.connect(self._on_explorer_node_selected)

    # --- Event handlers ---

    def _on_tree_switch(self, index: int):
        tree_name = self._tree_switcher.currentData()
        self._canvas.set_active_tree(tree_name)
        self._engine.set_active_tree(tree_name)
        # Show/hide nodes for this tree
        self._show_tree_nodes(tree_name)
        self._chat.load_global_chat()

    def _on_tree_switched_by_engine(self, tree_name: str):
        idx = self._tree_switcher.findData(tree_name)
        if idx >= 0:
            self._tree_switcher.blockSignals(True)
            self._tree_switcher.setCurrentIndex(idx)
            self._tree_switcher.blockSignals(False)
        self._canvas.set_active_tree(tree_name)
        self._show_tree_nodes(tree_name)

    def _on_node_create_request(self, node_type: str, label: str, x: float, y: float):
        nlabel = label or f"Новый {NODE_LABELS.get(node_type, 'узел')}"
        self._engine.add_node(nlabel, node_type, x=x, y=y)
        self._schedule_save()

    def _on_edge_create_request(self, source_id: str, target_id: str):
        eid = self._engine.add_edge(source_id, target_id)
        if eid:
            self._on_edge_added(eid)
            self._schedule_save()

    def _on_add_node(self):
        """Add node at the center of the current view."""
        center = self._canvas.mapToScene(
            self._canvas.viewport().rect().center()
        )
        types = NODE_TYPES_BY_TREE.get(self._engine.active_tree, {"feature"})
        default_type = sorted(types)[0]
        self._engine.add_node("Новый узел", default_type,
                              x=center.x(), y=center.y())
        self._schedule_save()

    def _on_node_moved(self, node_id: str, x: float, y: float):
        self._schedule_save()

    def _on_chat_message(self, node_id: str, text: str):
        """Handle user message from chat panel."""
        # For now, echo the message (LLM integration in Stage 5+)
        self._chat.set_loading(True)
        QTimer.singleShot(500, lambda: self._simulate_ai_response(node_id, text))

    def _simulate_ai_response(self, node_id: str, user_text: str):
        """Simulated AI response (placeholder)."""
        self._chat.set_loading(False)
        response = (
            f"Я понял твою мысль! В контексте "
            f"**{node_id if node_id == 'global' else 'этого узла'}** "
            f"это звучит следующим образом:\n\n"
            f"`{user_text[:100]}...`\n\n"
            f"📌 Подсказка: подключи API-ключ в настройках, "
            f"чтобы я мог обрабатывать запросы через LLM."
        )
        self._chat.append_message("sai", response)

    def _on_explorer_node_selected(self, data: str):
        if data.startswith("node:"):
            node_id = data[5:]
            node = self._engine.get_node(node_id)
            if node:
                self._chat.load_chat(node_id, node.label)
                self._highlight_node(node_id)

    def _on_export(self):
        """Export tree to Markdown TZ."""
        from src.services.export_service import ExportService
        service = ExportService()
        md = service.generate(self._engine)

        if not self._current_project_path:
            QMessageBox.information(self, "Экспорт", "Сначала сохраните проект.")
            return

        export_path = f"{self._current_project_path}/ТЗ.md"
        try:
            with open(export_path, "w") as f:
                f.write(md)
            QMessageBox.information(
                self, "Готово",
                f"✅ ТЗ сохранено в:\n{export_path}"
            )
        except OSError as e:
            QMessageBox.warning(self, "Ошибка", f"Не удалось сохранить: {e}")

    def _on_new_project(self):
        """Create new project."""
        path = QFileDialog.getExistingDirectory(self, "Выберите папку для проекта")
        if path:
            name = path.split("/")[-1]
            if self._file_store.create_project(path, name):
                self._current_project_path = path
                self._engine.new_project(name)
                self._scene.clear()
                self._update_title()
                self._chat.load_global_chat()
                self._refresh_explorer()

    def _on_open_project(self):
        """Open existing project."""
        path = QFileDialog.getExistingDirectory(self, "Выберите папку проекта")
        if path:
            data = self._file_store.load_project(path)
            if data:
                self._current_project_path = path
                self._engine.from_dict(data)
                self._scene.clear()
                self._rebuild_canvas_from_engine()
                self._update_title()
                self._chat.load_global_chat()
                self._refresh_explorer()
                self._config.set("last_project", path)

                # Restore view state
                view = self._engine.project.view
                self._canvas.resetTransform()
                self._canvas.scale(view.scale, view.scale)
                self._canvas.horizontalScrollBar().setValue(view.offset_x)
                self._canvas.verticalScrollBar().setValue(view.offset_y)

    def _on_save(self):
        self._autosave()

    def _on_settings(self):
        dialog = SettingsDialog(self._config, self)
        dialog.exec()

    def _on_about(self):
        QMessageBox.about(
            self, "О Sai",
            "<b>Sai</b> v0.0.1<br><br>"
            "ИИ-кофаундер и архитектор проектов.<br><br>"
            "Стек: Python + PySide6<br>"
            "Лицензия: Open Source (LGPL)"
        )

    # --- Internal ---

    def _show_tree_nodes(self, tree_name: str):
        """Show only nodes belonging to the active tree."""
        for item in self._scene.items():
            if hasattr(item, 'node_id'):
                node = self._engine.get_node(item.node_id)
                item.setVisible(node is not None and node.tree == tree_name)
            elif hasattr(item, 'edge_id'):
                item.setVisible(False)  # edges visibility handled separately

        # Show edges for this tree
        edges = self._engine.get_edges_for_tree(tree_name)
        edge_ids = {e.id for e in edges}
        for item in self._scene.items():
            if hasattr(item, 'edge_id'):
                item.setVisible(item.edge_id in edge_ids)

    def _rebuild_canvas_from_engine(self):
        """Rebuild all canvas items from engine data."""
        for tname in ["functional", "development", "business"]:
            nodes = self._engine.get_nodes_by_tree(tname)
            for node in nodes:
                self._create_node_item(node)

            edges = self._engine.get_edges_for_tree(tname)
            for edge in edges:
                self._create_edge_item(edge)

        self._show_tree_nodes(self._engine.active_tree)

    def _create_node_item(self, node):
        """Create a BoxNode on the canvas for a given node."""
        item = BoxNode(
            node.id, node.label, node.type, node.description,
            width=node.style.width or NODE_DEFAULT_WIDTH,
            height=node.style.height or NODE_DEFAULT_HEIGHT,
        )
        item.setPos(node.position.x, node.position.y)
        self._scene.addItem(item)
        return item

    def _create_edge_item(self, edge):
        """Create an EdgePath on the canvas for a given edge."""
        source_item = self._find_node_item(edge.source_id)
        target_item = self._find_node_item(edge.target_id)
        if source_item and target_item:
            edge_item = EdgePath(
                edge.id, source_item, target_item,
                color=edge.style.color, label=edge.label,
            )
            self._scene.addItem(edge_item)
            return edge_item
        return None

    def _find_node_item(self, node_id: str):
        """Find a BoxNode in the scene by its node_id."""
        for item in self._scene.items():
            if hasattr(item, 'node_id') and item.node_id == node_id:
                return item
        return None

    def _on_node_added(self, node_id: str, tree_name: str):
        node = self._engine.get_node(node_id)
        if node:
            self._create_node_item(node)
            self._refresh_explorer()

    def _on_edge_added(self, edge_id: str):
        edges = self._engine.get_edges_for_tree(self._engine.active_tree)
        for edge in edges:
            if edge.id == edge_id:
                self._create_edge_item(edge)
                break

    def _on_node_removed(self, node_id: str, tree_name: str):
        item = self._find_node_item(node_id)
        if item:
            self._scene.removeItem(item)
        self._refresh_explorer()

    def _highlight_node(self, node_id: str):
        item = self._find_node_item(node_id)
        if item:
            self._canvas.centerOn(item)
            item.set_highlight(True)
            QTimer.singleShot(2000, lambda: item.set_highlight(False))

    def _refresh_explorer(self):
        if self._current_project_path:
            files = self._file_store.get_project_files()
            self._explorer.set_project_files(files)
        nodes = self._engine.get_nodes_by_tree(self._engine.active_tree)
        self._explorer.set_nodes(nodes)

    def _update_title(self):
        name = self._engine.project.project.name
        self.setWindowTitle(f"Sai — {name}")

    def _schedule_save(self):
        if self._current_project_path:
            self._save_timer.start(1500)  # debounce 1.5s

    def _autosave(self):
        if self._current_project_path:
            self._file_store.create_backup()
            data = self._engine.to_dict()
            # Save view state
            data["view"]["offset_x"] = self._canvas.horizontalScrollBar().value()
            data["view"]["offset_y"] = self._canvas.verticalScrollBar().value()
            data["view"]["scale"] = self._canvas.transform().m11()
            self._file_store.save_tree(data)

    def closeEvent(self, event):
        """Save everything on close."""
        self._autosave()
        # Save window geometry
        self._config.set("window_geometry", list(self.saveGeometry()))
        self._config.set("window_state", list(self.saveState()))
        self._config.set("last_project", self._current_project_path)
        super().closeEvent(event)
