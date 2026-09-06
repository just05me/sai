"""MainWindow — frameless three-panel layout with focus mode."""

import os

from PySide6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QSplitter,
    QFileDialog, QMessageBox, QComboBox, QPushButton,
    QApplication,
)
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QKeySequence, QShortcut, QImage, QPainter, QColor

from src.core import GraphEngine, FileStore
from src.ui.canvas import InfiniteCanvas, CanvasScene
from src.ui.chat_panel import ChatPanel
from src.ui.project_explorer import ProjectExplorer
from src.ui.settings_dialog import SettingsDialog
from src.ui.title_bar import CustomTitleBar
from src.ui.empty_state import EmptyStateOverlay
from src.ui.nodes import BoxNode, EdgePath
from src.ui.widgets.minimap_widget import MinimapWidget
from src.services.llm_service import LLMService
from src.services.prompt_templates import PromptTemplates
from src.ui.export_dialog import ExportDialog
from src.utils.constants import (
    MANTLE, LIGHT_MANTLE, LIGHT_TEXT, LIGHT_SURFACE0, LIGHT_SURFACE1,
    TEXT, SURFACE0, BASE, LIGHT_BASE,
    NODE_TYPES_BY_TREE, NODE_LABELS,
    NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, APP_VERSION, SANTI,
)
from src.utils.config import Config
from src.utils.logger import Logger


class MainWindow(QMainWindow):
    """Frameless main window: explorer | canvas | chat."""

    def __init__(self, config: Config, app=None):
        super().__init__()
        self._config = config
        self._app = app
        self.log = Logger.get()
        self._is_dark = config.get("theme", "dark") == "dark"
        self._focus_mode = config.get("focus_mode", False)

        self._engine = GraphEngine(self)
        self._file_store = FileStore()
        self._llm = LLMService(self)
        self._current_project_path = ""
        self._node_items: dict[str, BoxNode] = {}
        self._edge_items: dict[str, EdgePath] = {}

        self._setup_window()
        self._setup_ui()
        self._setup_shortcuts()
        self._setup_signals()
        self._configure_llm()

        self._engine.new_project("Новый проект")
        self._update_title()
        self._refresh_empty_state()
        self._refresh_chats()
        self._try_load_last_project()

    def _setup_window(self):
        self.setWindowFlags(Qt.Window | Qt.FramelessWindowHint)
        self.resize(1400, 900)
        geo = self._config.get("window_geometry")
        if geo:
            try:
                if isinstance(geo, str):
                    self.restoreGeometry(bytes.fromhex(geo))
                elif isinstance(geo, (list, tuple)):
                    self.restoreGeometry(bytes(int(b) for b in geo))
                elif isinstance(geo, (bytes, bytearray)):
                    self.restoreGeometry(bytes(geo))
            except (ValueError, TypeError) as e:
                self.log.warning(f"Failed to restore window geometry: {e}")

    def _setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # Title bar
        self._title_bar = CustomTitleBar(self)
        self._title_bar.theme_toggle_requested.connect(self._toggle_theme)
        self._title_bar.minimize_requested.connect(self.showMinimized)
        self._title_bar.maximize_requested.connect(self._toggle_maximize)
        self._title_bar.close_requested.connect(self.close)
        root.addWidget(self._title_bar)

        # Toolbar row (tree switcher + export)
        self._toolbar = QWidget()
        self._toolbar.setObjectName("mainToolbar")
        self._toolbar.setFixedHeight(40)
        tb_layout = QHBoxLayout(self._toolbar)
        tb_layout.setContentsMargins(8, 4, 8, 4)
        tb_layout.setSpacing(8)

        self._tree_switcher = QComboBox()
        self._tree_switcher.setMinimumWidth(220)
        self._tree_switcher.setMinimumHeight(28)
        self._tree_switcher.addItem("🌳  Дерево функционала", "functional")
        self._tree_switcher.addItem("🛠  Дерево разработки", "development")
        self._tree_switcher.addItem("👤  Дерево бизнес-логики", "business")
        self._tree_switcher.currentIndexChanged.connect(self._on_tree_switch)
        tb_layout.addWidget(self._tree_switcher)

        new_btn = QPushButton("+ Узел")
        new_btn.setMinimumHeight(28)
        new_btn.clicked.connect(self._on_add_node)
        tb_layout.addWidget(new_btn)

        sync_btn = QPushButton("🔄 Синхронизация")
        sync_btn.setMinimumHeight(28)
        sync_btn.setToolTip("Синхронизировать деревья вручную")
        sync_btn.clicked.connect(self._on_sync_trees)
        tb_layout.addWidget(sync_btn)

        tb_layout.addStretch()

        export_btn = QPushButton("📄 Экспорт ТЗ")
        export_btn.setMinimumHeight(28)
        export_btn.setToolTip("Экспорт ТЗ с выбором узлов и деревьев")
        export_btn.clicked.connect(self._on_export)
        tb_layout.addWidget(export_btn)

        root.addWidget(self._toolbar)

        # Three-panel splitter
        self._splitter = QSplitter(Qt.Horizontal)

        self._explorer = ProjectExplorer(self)
        self._explorer.set_dark_theme(self._is_dark)
        self._splitter.addWidget(self._explorer)

        canvas_container = QWidget()
        canvas_layout = QVBoxLayout(canvas_container)
        canvas_layout.setContentsMargins(0, 0, 0, 0)
        canvas_layout.setSpacing(0)

        self._scene = CanvasScene(self)
        self._canvas = InfiniteCanvas(self._scene, self)
        self._canvas.set_engine(self._engine)
        self._canvas.set_dark_theme(self._is_dark)
        canvas_layout.addWidget(self._canvas, 1)

        self._minimap = MinimapWidget(self)
        self._minimap.set_dark_theme(self._is_dark)
        if not self._config.get("minimap_visible", True):
            self._minimap.hide()
        canvas_layout.addWidget(self._minimap)

        self._empty_state = EmptyStateOverlay()
        self._scene.addItem(self._empty_state)
        self._empty_state.center_in_scene(self._scene.sceneRect())
        self._empty_state.set_visible_for_empty(True)

        self._splitter.addWidget(canvas_container)

        self._chat = ChatPanel(self)
        self._chat.set_dark_theme(self._is_dark)
        self._chat.set_model(self._config.get("model", "gpt-4o"))
        self._splitter.addWidget(self._chat)

        self._splitter.setSizes([240, 800, 360])
        root.addWidget(self._splitter, 1)

        if self._focus_mode:
            self._apply_focus_mode(True)

        self._apply_window_style()

        # Initial minimap viewport after layout settles
        QTimer.singleShot(0, self._update_minimap_viewport)

    def _apply_window_style(self):
        if self._is_dark:
            bg = MANTLE
            text = TEXT
            surf = SURFACE0
            border = "#313244"
        else:
            bg = LIGHT_MANTLE
            text = LIGHT_TEXT
            surf = LIGHT_SURFACE0
            border = LIGHT_SURFACE1
        self.setStyleSheet(f"""
            QMainWindow {{ background: {bg}; }}
            QWidget#mainToolbar {{
                background: {bg};
                border-bottom: 1px solid {border};
            }}
            QWidget#mainToolbar QComboBox {{
                background: {surf};
                color: {text};
                border: 1px solid {border};
                border-radius: 6px;
                padding: 4px 10px;
            }}
            QWidget#mainToolbar QComboBox::drop-down {{
                border: none;
                width: 22px;
            }}
            QWidget#mainToolbar QComboBox QAbstractItemView {{
                background: {surf};
                color: {text};
                selection-background-color: {SANTI};
                selection-color: white;
                border: 1px solid {border};
            }}
            QWidget#mainToolbar QPushButton {{
                background: {surf};
                color: {text};
                border: 1px solid {border};
                border-radius: 6px;
                padding: 4px 12px;
            }}
            QWidget#mainToolbar QPushButton:hover {{
                background: {SANTI};
                color: white;
                border-color: {SANTI};
            }}
        """)

    def _setup_shortcuts(self):
        QShortcut(QKeySequence("Ctrl+B"), self, self._toggle_focus_mode)
        QShortcut(QKeySequence("Ctrl+L"), self, lambda: self._chat.setFocus())

    def _setup_signals(self):
        self._canvas.node_create_requested.connect(self._on_node_create)
        self._canvas.edge_create_requested.connect(self._on_edge_create)
        self._canvas.node_delete_requested.connect(self._on_node_delete)
        self._canvas.node_selected.connect(self._on_canvas_node_selected)
        self._canvas.empty_changed.connect(self._on_empty_changed)
        self._canvas.node_edit_requested.connect(self._on_node_edit)
        self._canvas.edge_edit_requested.connect(self._on_edge_edit)
        self._canvas.edge_delete_requested.connect(self._on_edge_delete)
        self._canvas.bulk_delete_requested.connect(self._on_bulk_delete)
        self._canvas.bulk_type_change_requested.connect(self._on_bulk_type_change)
        self._canvas.bulk_status_change_requested.connect(self._on_bulk_status_change)
        self._engine.node_updated.connect(self._on_node_updated)

        self._engine.node_added.connect(self._on_node_added)
        self._engine.node_removed.connect(self._on_node_removed)
        self._engine.edge_added.connect(self._on_edge_added)
        self._engine.edge_removed.connect(self._on_edge_removed)
        self._engine.node_moved.connect(self._on_node_moved)

        # Update minimap viewport on scroll/zoom
        self._canvas.horizontalScrollBar().valueChanged.connect(self._update_minimap_viewport)
        self._canvas.verticalScrollBar().valueChanged.connect(self._update_minimap_viewport)

        self._chat.message_sent.connect(self._on_chat_message)
        self._explorer.node_selected.connect(self._on_explorer_node_selected)
        self._explorer.chat_selected.connect(self._on_chat_selected)
        self._explorer.settings_requested.connect(self._on_settings)

        self._llm.response_received.connect(self._on_llm_response)
        self._llm.response_error.connect(self._on_llm_error)
        self._llm.response_stream.connect(self._on_llm_stream)

        self._title_bar._menu_btn.clicked.connect(self._show_file_menu)

    def _configure_llm(self):
        self._llm.configure(
            self._config.get("api_key", ""),
            self._config.get("base_url", "https://api.openai.com/v1"),
            self._config.get("model", "gpt-4o"),
            self._config.get("api_type", "openai"),
        )

    def _show_file_menu(self):
        from PySide6.QtWidgets import QMenu
        menu = QMenu(self)
        menu.addAction("Новый проект", self._on_new_project)
        menu.addAction("Открыть проект…", self._on_open_project)
        menu.addAction("Сохранить", self._autosave)
        menu.addSeparator()
        menu.addAction("Выход", self.close)
        if self._is_dark:
            menu.setStyleSheet(f"""
                QMenu {{ background:#181825; color:{TEXT}; border-radius:6px; padding:4px; }}
                QMenu::item {{ padding:6px 16px; border-radius:6px; }}
                QMenu::item:selected {{ background:{SANTI}; color:white; }}
            """)
        else:
            menu.setStyleSheet(f"""
                QMenu {{ background:{LIGHT_MANTLE}; color:{LIGHT_TEXT}; border:1px solid {LIGHT_SURFACE1}; border-radius:6px; padding:4px; }}
                QMenu::item {{ padding:6px 16px; border-radius:6px; }}
                QMenu::item:selected {{ background:{SANTI}; color:white; }}
            """)
        menu.exec(self._title_bar._menu_btn.mapToGlobal(
            self._title_bar._menu_btn.rect().bottomLeft()
        ))

    def _toggle_maximize(self):
        if self.isMaximized():
            self.showNormal()
        else:
            self.showMaximized()

    def _toggle_theme(self):
        self._is_dark = not self._is_dark
        self._apply_theme_everywhere()
        self._engine.set_view_state(theme="dark" if self._is_dark else "light")

    def _apply_theme_everywhere(self):
        if self._app:
            self._app.set_dark_theme(self._is_dark)
        self._title_bar.set_dark_theme(self._is_dark)
        self._canvas.set_dark_theme(self._is_dark)
        self._chat.set_dark_theme(self._is_dark)
        self._minimap.set_dark_theme(self._is_dark)
        self._explorer.set_dark_theme(self._is_dark)
        self._apply_window_style()

    def _toggle_focus_mode(self):
        self._focus_mode = not self._focus_mode
        self._apply_focus_mode(self._focus_mode)
        self._config.set("focus_mode", self._focus_mode)
        self._engine.set_view_state(focus_mode=self._focus_mode)

    def _apply_focus_mode(self, enabled: bool):
        self._explorer.setVisible(not enabled)
        self._chat.setVisible(not enabled)

    # --- Canvas / Engine ---

    def _on_tree_switch(self, index: int):
        tree = self._tree_switcher.currentData()
        self._canvas.set_active_tree(tree)
        self._engine.set_active_tree(tree)
        self._show_tree_nodes(tree)
        self._refresh_minimap()
        self._chat.load_global_chat()
        self._refresh_explorer()

    def _on_node_create(self, node_type: str, label: str, x: float, y: float):
        nlabel = label or f"Новый {NODE_LABELS.get(node_type, 'узел')}"
        node_id = self._engine.add_node(nlabel, node_type, x=x, y=y)
        self._schedule_save()
        self._refresh_empty_state()

    def _on_edge_create(self, source_id: str, target_id: str, source_side: str, target_side: str):
        # #region agent log
        import json as _json, time as _time
        # #endregion
        eid = self._engine.add_edge(
            source_id,
            target_id,
            source_side=source_side,
            target_side=target_side,
        )
        # #region agent log
        try:
            with open("/home/rizo/sai/.cursor/debug-bcd4e6.log","a") as _f:
                _f.write(_json.dumps({"sessionId":"bcd4e6","runId":"post-fix","hypothesisId":"H6","location":"main_window.py:_on_edge_create","message":"edge created via engine","data":{"edge_id":eid,"edge_items_after":len(self._edge_items)},"timestamp":int(_time.time()*1000)})+"\n")
        except Exception: pass
        # #endregion
        if eid:
            self._schedule_save()
            self._refresh_minimap()

    def _on_node_delete(self, node_id: str):
        # #region agent log
        import json, time
        _t0 = time.perf_counter()
        _edges_before = sum(len(t.edges) for t in self._engine.project.trees.values())
        _scene_items_before = len(self._scene.items())
        _edge_items_before = len(self._edge_items)
        def _agentlog(stage, **extra):
            try:
                with open("/home/rizo/sai/.cursor/debug-bcd4e6.log", "a") as _f:
                    _f.write(json.dumps({"sessionId":"bcd4e6","hypothesisId":"H1","location":f"main_window.py:_on_node_delete:{stage}","message":stage,"data":{"node_id":node_id,"ms_since_start":round((time.perf_counter()-_t0)*1000,2),**extra},"timestamp":int(time.time()*1000)})+"\n")
            except Exception: pass
        _agentlog("entry", edges_before=_edges_before, scene_items=_scene_items_before, edge_items_tracked=_edge_items_before)
        # #endregion
        node = self._engine.get_node(node_id)
        if not node:
            return
        self._engine.remove_node(node_id)
        # #region agent log
        _edges_after = sum(len(t.edges) for t in self._engine.project.trees.values())
        _agentlog("after_remove_node", edges_after_model=_edges_after, edges_removed=_edges_before-_edges_after, edge_items_still_tracked=len(self._edge_items), scene_items_now=len(self._scene.items()))
        # #endregion
        item = self._node_items.pop(node_id, None)
        if item:
            self._scene.removeItem(item)
        # #region agent log
        _agentlog("after_scene_remove_node", scene_items_after=len(self._scene.items()), edge_items_orphan=len(self._edge_items))
        # #endregion
        self._refresh_explorer()
        # #region agent log
        _agentlog("after_refresh_explorer")
        # #endregion
        self._refresh_empty_state()
        # #region agent log
        _agentlog("after_refresh_empty_state")
        # #endregion
        self._schedule_save()
        # #region agent log
        _agentlog("done")
        # #endregion

    def _on_add_node(self):
        center = self._canvas.mapToScene(self._canvas.viewport().rect().center())
        types = NODE_TYPES_BY_TREE.get(self._engine.active_tree, {"feature"})
        self._engine.add_node("Новый узел", sorted(types)[0], x=center.x(), y=center.y())
        self._schedule_save()
        self._refresh_empty_state()

    def _on_node_added(self, node_id: str, tree_name: str):
        node = self._engine.get_node(node_id)
        if node:
            self._create_node_item(node)
            self._refresh_explorer()
            self._refresh_chats()
            self._refresh_empty_state()
            self._refresh_minimap()

    def _on_node_removed(self, node_id: str, tree_name: str):
        item = self._node_items.pop(node_id, None)
        if item:
            self._scene.removeItem(item)
        self._refresh_explorer()
        self._refresh_empty_state()

    def _on_edge_added(self, edge_id: str):
        edge = self._engine.get_edge(edge_id)
        if edge:
            self._create_edge_item(edge)
            self._refresh_minimap()

    def _on_edge_removed(self, edge_id: str):
        # #region agent log
        import json as _json, time as _time
        try:
            with open("/home/rizo/sai/.cursor/debug-bcd4e6.log","a") as _f:
                _f.write(_json.dumps({"sessionId":"bcd4e6","runId":"post-fix","hypothesisId":"H1","location":"main_window.py:_on_edge_removed","message":"removing EdgePath","data":{"edge_id":edge_id,"tracked":edge_id in self._edge_items},"timestamp":int(_time.time()*1000)})+"\n")
        except Exception: pass
        # #endregion
        item = self._edge_items.pop(edge_id, None)
        if item is None:
            return
        for h in list(getattr(item, "_control_handles", []) or []):
            try:
                if h.scene():
                    h.scene().removeItem(h)
            except RuntimeError:
                pass
        try:
            item._control_handles.clear()
        except Exception:
            pass
        try:
            if item.scene():
                self._scene.removeItem(item)
        except RuntimeError:
            pass
        self._refresh_minimap()

    def _on_node_moved(self, node_id: str, x: float, y: float):
        self._schedule_save()
        self._refresh_minimap()

    def _update_minimap_viewport(self):
        vr = self._canvas.mapToScene(self._canvas.viewport().rect()).boundingRect()
        self._minimap.set_viewport(vr)

    def _create_node_item(self, node) -> BoxNode:
        item = BoxNode(
            node.id, node.label, node.type, node.description,
            width=node.style.width or NODE_DEFAULT_WIDTH,
            height=node.style.height or NODE_DEFAULT_HEIGHT,
            show_description=node.style.show_description,
            show_tags=node.style.show_tags,
            show_ai_status=node.style.show_ai_status,
            generated_by=node.metadata.generated_by,
        )
        item.setPos(node.position.x, node.position.y)
        item.node_label = node.label
        self._scene.addItem(item)
        self._node_items[node.id] = item
        return item

    def _create_edge_item(self, edge) -> EdgePath | None:
        source = self._node_items.get(edge.source_id)
        target = self._node_items.get(edge.target_id)
        if not source or not target:
            return None
        cp = [{"x": p.x, "y": p.y} for p in edge.control_points]
        item = EdgePath(
            edge.id, source, target,
            color=edge.style.color, label=edge.label,
            control_points=cp,
            source_side=getattr(edge, "source_side", "") or "",
            target_side=getattr(edge, "target_side", "") or "",
        )
        self._scene.addItem(item)
        self._edge_items[edge.id] = item
        return item

    def _show_tree_nodes(self, tree_name: str):
        edge_ids = {e.id for e in self._engine.get_edges_for_tree(tree_name)}
        for nid, item in self._node_items.items():
            node = self._engine.get_node(nid)
            item.setVisible(node is not None and node.tree == tree_name)
        for eid, item in self._edge_items.items():
            item.setVisible(eid in edge_ids)

    def _rebuild_canvas(self):
        self._scene.clear()
        self._node_items.clear()
        self._edge_items.clear()
        self._empty_state = EmptyStateOverlay()
        self._scene.addItem(self._empty_state)
        self._empty_state.center_in_scene(self._scene.sceneRect())

        for tname in ("functional", "development", "business"):
            for node in self._engine.get_nodes_by_tree(tname):
                self._create_node_item(node)
            for edge in self._engine.get_edges_for_tree(tname):
                self._create_edge_item(edge)

        self._show_tree_nodes(self._engine.active_tree)
        self._refresh_empty_state()

    def _refresh_empty_state(self):
        count = len(self._engine.get_nodes_by_tree(self._engine.active_tree))
        is_empty = count == 0
        self._empty_state.set_visible_for_empty(is_empty)
        self._empty_state.center_in_scene(self._scene.sceneRect())

    def _on_empty_changed(self, is_empty: bool):
        self._empty_state.set_visible_for_empty(is_empty)

    def _refresh_minimap(self):
        nodes = self._engine.get_nodes_by_tree(self._engine.active_tree)
        edges = self._engine.get_edges_for_tree(self._engine.active_tree)
        self._minimap.update_graph(nodes, edges)

    # --- Chat / LLM ---

    def _on_chat_message(self, node_id: str, text: str):
        self._chat.set_loading(True)
        self._save_chat_message(node_id, "user", text)

        if node_id == "global":
            tree_label = self._engine.active_tree
            tree_keywords = (
                "сделай дерево", "построй дерево", "создай дерево",
                "сгенерируй дерево", "разложи на функции", "построй функционал",
                "make tree", "generate tree", "build tree",
            )
            wants_tree = any(k in text.lower() for k in tree_keywords)

            if wants_tree:
                ctx = (
                    f"Ты — ИИ-архитектор продуктов Sai. Активное дерево: «{tree_label}».\n"
                    "Пользователь явно попросил сгенерировать дерево функционала.\n"
                    "Верни СТРОГО JSON без какого-либо текста до или после, без markdown-обёртки.\n"
                    "Структура:\n"
                    "{\"nodes\":[{\"id\":\"<uuid>\",\"label\":\"<рус. название>\","
                    "\"description\":\"<кратко>\",\"type\":\"feature\"}],"
                    "\"edges\":[{\"source_id\":\"<uuid>\",\"target_id\":\"<uuid>\","
                    "\"edge_type\":\"dependency\",\"label\":\"\"}]}\n"
                    "Используй уникальные UUID-подобные строки для id. "
                    "Сгенерируй 5–10 узлов и логичные связи между ними.\n"
                    "Если в сообщении нет конкретной идеи продукта — вырази её сам исходя из контекста "
                    "и всё равно верни JSON, не задавай уточняющих вопросов."
                )
                self._llm.send_message(node_id, text, {"system": ctx}, stream=False)
            else:
                ctx = (
                    "Ты — ИИ-архитектор продуктов Sai. Помогаешь пользователю продумать идею.\n"
                    "Отвечай кратко, по существу, на русском языке. Не повторяй приветствия.\n"
                    "Если пользователь ПРОСИТ сгенерировать дерево функций — верни ТОЛЬКО JSON без пояснений:\n"
                    "{\"nodes\":[{\"id\":\"uuid\",\"label\":\"...\",\"description\":\"...\",\"type\":\"feature\"}],"
                    "\"edges\":[{\"source_id\":\"uuid\",\"target_id\":\"uuid\",\"edge_type\":\"dependency\",\"label\":\"\"}]}"
                )
                self._llm.send_message(node_id, text, {"system": ctx}, stream=True)
        else:
            node = self._engine.get_node(node_id)
            neighbors = self._engine.get_connected_nodes(node_id)
            ctx = PromptTemplates.NODE_CHAT_SYSTEM.format(
                node_label=node.label if node else node_id,
                node_description=node.description if node else "",
                node_type=node.type if node else "",
                neighbors="\n".join(f"- {n.label}" for n in neighbors) or "нет",
            )
            self._llm.send_message(node_id, text, {"system": ctx}, stream=True)
            if node_id in self._node_items:
                self._node_items[node_id].set_thinking(True)

    def _on_llm_stream(self, node_id: str, chunk: str):
        self._chat.append_stream_chunk(chunk)

    def _on_llm_response(self, node_id: str, response: str):
        self._chat.finalize_response(response)
        self._save_chat_message(node_id, "sai", response)

        if node_id in self._node_items:
            self._node_items[node_id].set_thinking(False)

        if node_id == "global":
            data = LLMService.try_parse_brainstorm_json(response)
            if data:
                count = self._engine.apply_brainstorm_json(data)
                self._rebuild_canvas()
                self._chat.append_message(
                    "sai", f"Построено узлов: {count}. Проверьте дерево на холсте."
                )
                self._schedule_save()

    def _on_llm_error(self, node_id: str, error: str):
        self._chat.finish_stream()
        self._chat.append_message("sai", f"Ошибка: {error}")
        if node_id in self._node_items:
            self._node_items[node_id].set_thinking(False)

    def _save_chat_message(self, node_id: str, role: str, text: str):
        if not self._current_project_path:
            return
        from datetime import datetime
        chat_id = "global" if node_id == "global" else f"node_{node_id[:8]}"
        fname = "global.md" if node_id == "global" else f"{chat_id}.md"
        path = os.path.join(self._current_project_path, "chats", fname)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%dT%H:%M")
        role_label = "User" if role == "user" else "Sai"
        line = f"\n## [{ts}] {role_label}:\n{text}\n"
        with open(path, "a") as f:
            f.write(line)

    def _on_canvas_node_selected(self, node_id: str):
        node = self._engine.get_node(node_id)
        if node:
            self._chat.load_chat(node_id, node.label)
            self._chat.set_context_nodes(self._engine.get_connected_nodes(node_id))

    def _on_explorer_node_selected(self, data: str):
        if data.startswith("node:"):
            self._on_canvas_node_selected(data[5:])

    def _on_chat_selected(self, chat_id: str):
        if chat_id == "global":
            self._chat.load_global_chat()
        else:
            node = self._engine.get_node(chat_id)
            if node:
                self._chat.load_chat(chat_id, node.label)

    # --- Project I/O ---

    def _on_new_project(self):
        path = QFileDialog.getExistingDirectory(self, "Папка для нового проекта")
        if path:
            name = os.path.basename(path)
            if self._file_store.create_project(path, name):
                self._current_project_path = path
                self._engine.new_project(name)
                self._rebuild_canvas()
                self._update_title()
                self._chat.load_global_chat()
                self._refresh_explorer()
                self._config.set("last_project", path)

    def _on_open_project(self):
        path = QFileDialog.getExistingDirectory(self, "Открыть проект")
        if path:
            data = self._file_store.load_project(path)
            if data:
                self._current_project_path = path
                self._engine.from_dict(data)
                self._rebuild_canvas()
                self._update_title()
                self._chat.load_global_chat()
                self._refresh_explorer()
                self._config.set("last_project", path)

                view = self._engine.project.view
                target_dark = view.theme != "light"
                if target_dark != self._is_dark:
                    self._is_dark = target_dark
                    self._apply_theme_everywhere()
                self._canvas.resetTransform()
                self._canvas.scale(view.scale, view.scale)

    def _try_load_last_project(self):
        last = self._config.get("last_project", "")
        if last and os.path.isdir(last):
            data = self._file_store.load_project(last)
            if data:
                self._current_project_path = last
                self._engine.from_dict(data)
                self._rebuild_canvas()
                self._update_title()
                self._refresh_explorer()

    def _on_export(self):
        dialog = ExportDialog(self._engine, self)
        dialog.exec()

    def _on_sync_trees(self):
        """Manual sync: send current tree to LLM and update others."""
        nodes = self._engine.get_nodes_by_tree(self._engine.active_tree)
        if not nodes:
            QMessageBox.information(self, "Синхронизация",
                "Текущее дерево пусто. Сначала создайте узлы.")
            return
        if not self._config.get("api_key", ""):
            QMessageBox.warning(self, "Синхронизация",
                "API ключ не настроен. Откройте ⚙ Настройки.")
            return

        node_list = "\n".join(
            f"- {n.label}: {n.description or 'Нет описания'}" for n in nodes
        )
        prompt = (
            f"Вот текущее дерево ({self._engine.active_tree}):\n{node_list}\n\n"
            f"Предложи улучшения: что добавить, изменить или перестроить.\n"
            f"Если нужно создать новые узлы — верни JSON в формате:\n"
            f"{'{\"nodes\":[{\"id\":\"uuid\",\"label\":\"...\",\"description\":\"...\",\"type\":\"feature\"}],\"edges\":[{\"source_id\":\"uuid\",\"target_id\":\"uuid\",\"edge_type\":\"dependency\"}]}'}"
        )
        self._chat.load_global_chat()
        self._chat.append_message("user", f"🔄 Синхронизация дерева «{self._tree_switcher.currentText()}»")
        self._chat.set_loading(True)
        self._llm.send_message("global", prompt, {
            "system": "Ты — ИИ-архитектор. Анализируй дерево и предлагай улучшения."
        }, stream=True)

    def _on_settings(self):
        if SettingsDialog.show_modal(self._config, self):
            self._configure_llm()
            self._chat.set_model(self._config.get("model", "gpt-4o"))

    def _refresh_explorer(self):
        if self._current_project_path:
            self._file_store._project_path = self._current_project_path
            self._explorer.set_project_files(self._file_store.get_project_files())
        nodes = self._engine.get_nodes_by_tree(self._engine.active_tree)
        self._explorer.set_nodes(nodes)
        self._chat.set_context_nodes(nodes)
        self._refresh_chats()

    def _refresh_chats(self):
        chats = [{"id": "global", "label": "🌐 Global Brainstorm"}]
        for node in self._engine.get_nodes_by_tree(self._engine.active_tree):
            chats.append({"id": node.id, "label": f"💬 {node.label[:25]}"})
        self._explorer.set_chats(chats)

    def _update_title(self):
        name = self._engine.project.project.name
        self._title_bar.set_project_name(f"Sai — {name}")

    def _schedule_save(self):
        if self._current_project_path:
            if not hasattr(self, "_save_timer"):
                self._save_timer = QTimer(self)
                self._save_timer.setSingleShot(True)
                self._save_timer.timeout.connect(self._autosave)
            self._save_timer.start(1500)

    def _autosave(self):
        if not self._current_project_path:
            return
        self._file_store._project_path = self._current_project_path
        self._file_store.create_backup()
        data = self._engine.to_dict()
        data["view"]["offset_x"] = self._canvas.horizontalScrollBar().value()
        data["view"]["offset_y"] = self._canvas.verticalScrollBar().value()
        data["view"]["scale"] = self._canvas.transform().m11()
        data["view"]["theme"] = "dark" if self._is_dark else "light"
        data["view"]["focus_mode"] = self._focus_mode
        self._file_store.save_tree(data)

    # --- Node/Edge editing ---

    def _on_node_edit(self, node_id: str, field: str, value: str):
        if field == "type":
            self._engine.update_node(node_id, type=value)
        elif field in ("label", "description", "status"):
            self._engine.update_node(node_id, **{field: value})
        self._schedule_save()

    def _on_edge_edit(self, edge_id: str, field: str, value: str):
        self._engine.update_edge(edge_id, **{field: value})
        self._schedule_save()

    def _on_edge_delete(self, edge_id: str):
        self._engine.remove_edge(edge_id)
        self._schedule_save()

    def _on_bulk_delete(self, node_ids: list):
        for nid in node_ids:
            self._engine.remove_node(nid)
            item = self._node_items.pop(nid, None)
            if item is not None and item.scene():
                self._scene.removeItem(item)
        self._refresh_explorer()
        self._refresh_empty_state()
        self._refresh_minimap()
        self._schedule_save()

    def _on_bulk_type_change(self, node_ids: list, new_type: str):
        for nid in node_ids:
            self._engine.update_node(nid, type=new_type)
        self._schedule_save()

    def _on_bulk_status_change(self, node_ids: list, new_status: str):
        for nid in node_ids:
            self._engine.update_node(nid, status=new_status)
        self._schedule_save()

    def _on_node_updated(self, node_id: str):
        """Sync BoxNode visuals with engine data."""
        node = self._engine.get_node(node_id)
        item = self._node_items.get(node_id)
        if node and item:
            item.node_label = node.label
            item.set_description(node.description)
            item.set_node_type(node.type)
            item.set_status(node.status)

    # --- Hotkey actions ---

    def _on_delete_selected(self):
        node_ids = self._canvas.get_selected_node_ids()
        edge_ids = self._canvas.get_selected_edge_ids()
        if not node_ids and not edge_ids:
            return
        for eid in edge_ids:
            self._canvas.edge_delete_requested.emit(eid)
        for nid in node_ids:
            self._canvas.node_delete_requested.emit(nid)

    def _on_select_all(self):
        self._canvas.select_all_nodes()

    def _on_duplicate_node(self):
        node_ids = self._canvas.get_selected_node_ids()
        if not node_ids:
            return
        self._engine.duplicate_node(node_ids[0])
        self._schedule_save()

    def _on_undo(self):
        if self._engine.undo():
            self._schedule_save()

    def _on_redo(self):
        if self._engine.redo():
            self._schedule_save()

    # --- Project lifecycle events ---

    def _on_project_changed(self):
        """Rebuild UI after project load / undo / redo."""
        self._rebuild_canvas()
        self._update_title()
        tree = self._engine.active_tree
        idx = self._tree_switcher.findData(tree)
        if idx >= 0 and self._tree_switcher.currentIndex() != idx:
            self._tree_switcher.blockSignals(True)
            self._tree_switcher.setCurrentIndex(idx)
            self._tree_switcher.blockSignals(False)

    # --- Export ---

    def _on_export_image(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Экспорт как PNG", "", "PNG (*.png)"
        )
        if not path:
            return
        rect = self._scene.sceneRect()
        w, h = int(rect.width()), int(rect.height())
        if w <= 0 or h <= 0:
            return
        image = QImage(w, h, QImage.Format_ARGB32_Premultiplied)
        bg = BASE if self._is_dark else LIGHT_BASE
        image.fill(QColor(bg))
        painter = QPainter(image)
        painter.setRenderHint(QPainter.Antialiasing)
        self._scene.render(painter)
        painter.end()
        image.save(path)
        self.log.info(f"Exported image: {path}")

    # --- Recent projects ---

    def _track_recent_project(self, path: str):
        recent = self._config.get("recent_projects", [])
        if path in recent:
            recent.remove(path)
        recent.insert(0, path)
        self._config.set("recent_projects", recent[:5])

    def _on_open_recent(self, path: str):
        if not os.path.isdir(path):
            QMessageBox.warning(self, "Ошибка", f"Проект не найден:\n{path}")
            recent = self._config.get("recent_projects", [])
            if path in recent:
                recent.remove(path)
                self._config.set("recent_projects", recent)
            return
        data = self._file_store.load_project(path)
        if data:
            self._current_project_path = path
            self._engine.from_dict(data)
            self._chat.load_global_chat()
            self._refresh_explorer()
            self._track_recent_project(path)
            view = self._engine.project.view
            target_dark = view.theme != "light"
            if target_dark != self._is_dark:
                self._is_dark = target_dark
                self._apply_theme_everywhere()
            self._canvas.resetTransform()
            self._canvas.scale(view.scale, view.scale)

    def closeEvent(self, event):
        self._autosave()
        try:
            geo_bytes = bytes(self.saveGeometry())
            self._config.set("window_geometry", geo_bytes.hex())
        except Exception as e:
            self.log.warning(f"Failed to save window geometry: {e}")
        self._config.set("last_project", self._current_project_path)
        super().closeEvent(event)
