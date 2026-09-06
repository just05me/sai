"""InfiniteCanvas — QGraphicsView with dot grid, zoom, pan, node creation."""

import math

from PySide6.QtWidgets import (
    QGraphicsView, QGraphicsScene, QMenu, QInputDialog, QMessageBox,
    QRubberBand,
)
from PySide6.QtGui import QPainter, QPen, QColor, QBrush, QKeyEvent
from PySide6.QtCore import Qt, QPointF, Signal, QRectF, QTimer, QRect, QSize

from src.ui.confirm_dialog import ConfirmDialog

from src.utils.constants import (
    BASE, LIGHT_BASE, LIGHT_MANTLE, LIGHT_TEXT, LIGHT_SURFACE1,
    TEXT, MANTLE, SURFACE0,
    GRID_SIZE, SCENE_SIZE,
    ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, NODE_TYPES_BY_TREE, NODE_LABELS,
    GRID_DOT_DARK, GRID_DOT_LIGHT, SANTI, NODE_COLORS, EDGE_TYPES,
)


NODE_STATUSES = ["draft", "review", "done", "deprecated"]
NODE_STATUS_LABELS = {
    "draft": "Черновик", "review": "На ревью",
    "done": "Готово", "deprecated": "Устарело",
}

# Pixels of right-button movement before we switch from "context menu intent"
# to "rubber-band multi-select intent".
RMB_DRAG_THRESHOLD = 6


class CanvasScene(QGraphicsScene):
    """Scene with dot-grid background (24px)."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setSceneRect(-SCENE_SIZE / 2, -SCENE_SIZE / 2, SCENE_SIZE, SCENE_SIZE)
        self._grid_size = GRID_SIZE
        self._is_dark = True

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        self.invalidate(self.sceneRect(), QGraphicsScene.BackgroundLayer)

    def drawBackground(self, painter: QPainter, rect: QRectF):
        bg = BASE if self._is_dark else LIGHT_BASE
        dot_color = GRID_DOT_DARK if self._is_dark else GRID_DOT_LIGHT
        painter.fillRect(rect, QColor(bg))

        left = math.floor(rect.left() / self._grid_size) * self._grid_size
        top = math.floor(rect.top() / self._grid_size) * self._grid_size

        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(QColor(dot_color)))
        r = 1.2
        x = left
        while x < rect.right():
            y = top
            while y < rect.bottom():
                painter.drawEllipse(QPointF(x, y), r, r)
                y += self._grid_size
            x += self._grid_size


class InfiniteCanvas(QGraphicsView):
    """Main canvas: zoom, pan (Space+LMB/MMB), double-click to create node."""

    node_create_requested = Signal(str, str, float, float)
    edge_create_requested = Signal(str, str, str, str)
    node_delete_requested = Signal(str)
    edge_delete_requested = Signal(str)
    node_selected = Signal(str)
    empty_changed = Signal(bool)
    node_edit_requested = Signal(str, str, str)  # node_id, field, value
    edge_edit_requested = Signal(str, str, str)  # edge_id, field, value
    nodes_select_all_requested = Signal()
    zoom_changed = Signal()
    bulk_delete_requested = Signal(list)  # node_ids
    bulk_type_change_requested = Signal(list, str)  # node_ids, new_type
    bulk_status_change_requested = Signal(list, str)  # node_ids, new_status
    cross_tree_bridge_activated = Signal(str)  # bridge_id

    def __init__(self, scene: QGraphicsScene, parent=None):
        super().__init__(scene, parent)

        self.setRenderHint(QPainter.Antialiasing)
        self.setRenderHint(QPainter.SmoothPixmapTransform)
        self.setRenderHint(QPainter.TextAntialiasing)

        self.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.setDragMode(QGraphicsView.NoDrag)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)
        self.setResizeAnchor(QGraphicsView.AnchorUnderMouse)
        self.setViewportUpdateMode(QGraphicsView.MinimalViewportUpdate)

        self._space_pressed = False
        self._mmb_panning = False
        self._dragging_edge = False
        self._drag_source_port = None
        self._drag_source_node = None
        self._temp_line = None
        self._active_tree = "functional"
        self._engine = None
        self._is_dark = True
        self._mmb_start_pos = QPointF()

        # Right-mouse-button intent tracking (context menu vs rubber-band).
        self._rmb_press_pos: QPointF | None = None
        self._rmb_rubber = QRubberBand(QRubberBand.Rectangle, self.viewport())
        self._rmb_rubber.hide()
        self._rmb_rubber_active = False

        self.setStyleSheet("border: none; background: transparent;")
        self.setFocusPolicy(Qt.StrongFocus)

    def set_engine(self, engine):
        self._engine = engine

    def set_active_tree(self, tree_name: str):
        self._active_tree = tree_name

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        if isinstance(self.scene(), CanvasScene):
            self.scene().set_dark_theme(is_dark)

    def _menu_stylesheet(self) -> str:
        if self._is_dark:
            return f"""
                QMenu {{
                    background: #181825;
                    color: {TEXT};
                    border: 1px solid #313244;
                    border-radius: 6px;
                    padding: 4px;
                }}
                QMenu::item {{ padding: 6px 20px; border-radius: 6px; }}
                QMenu::item:selected {{ background: {SANTI}; color: white; }}
                QMenu::separator {{ background: #313244; height: 1px; margin: 4px 8px; }}
            """
        return f"""
            QMenu {{
                background: {LIGHT_MANTLE};
                color: {LIGHT_TEXT};
                border: 1px solid {LIGHT_SURFACE1};
                border-radius: 6px;
                padding: 4px;
            }}
            QMenu::item {{ padding: 6px 20px; border-radius: 6px; }}
            QMenu::item:selected {{ background: {SANTI}; color: white; }}
            QMenu::separator {{ background: {LIGHT_SURFACE1}; height: 1px; margin: 4px 8px; }}
        """

    def fit_all(self):
        """Zoom to fit all nodes in view."""
        items = self.scene().items()
        nodes = [i for i in items if hasattr(i, "node_id") and i.isVisible()]
        if not nodes:
            return
        rect = None
        for n in nodes:
            br = n.mapRectToScene(n.boundingRect())
            rect = br if rect is None else rect.united(br)
        if rect is None:
            return
        margin = 60
        rect = rect.adjusted(-margin, -margin, margin, margin)
        self.fitInView(rect, Qt.KeepAspectRatio)
        current = self.transform().m11()
        current = max(ZOOM_MIN, min(ZOOM_MAX, current))
        self.zoom_changed.emit()

    # --- Wheel: Ctrl=zoom, Shift=pan X, plain=pan Y ---

    def wheelEvent(self, event):
        modifiers = event.modifiers()
        angle = event.angleDelta()
        delta_y = angle.y()
        delta_x = angle.x()

        if modifiers & Qt.ControlModifier:
            ref = delta_y or delta_x
            if ref == 0:
                event.accept()
                return
            factor = ZOOM_STEP if ref > 0 else 1 / ZOOM_STEP
            current = self.transform().m11()
            new_scale = current * factor
            if ZOOM_MIN < new_scale < ZOOM_MAX:
                self.scale(factor, factor)
                self.zoom_changed.emit()
            event.accept()
            return

        step = 60

        if modifiers & Qt.ShiftModifier:
            ref = delta_y or delta_x
            sb = self.horizontalScrollBar()
            sb.setValue(sb.value() - int(ref / 120.0 * step))
            event.accept()
            return

        if delta_y:
            sb = self.verticalScrollBar()
            sb.setValue(sb.value() - int(delta_y / 120.0 * step))
        if delta_x:
            sb = self.horizontalScrollBar()
            sb.setValue(sb.value() - int(delta_x / 120.0 * step))
        event.accept()

    # --- Keyboard: Space for pan ---

    def keyPressEvent(self, event: QKeyEvent):
        if event.key() == Qt.Key_Space and not event.isAutoRepeat():
            self._space_pressed = True
            if not self._mmb_panning:
                self.setDragMode(QGraphicsView.ScrollHandDrag)
                self.setCursor(Qt.ClosedHandCursor)
            event.accept()
            return
        super().keyPressEvent(event)

    def keyReleaseEvent(self, event: QKeyEvent):
        if event.key() == Qt.Key_Space and not event.isAutoRepeat():
            self._space_pressed = False
            if not self._mmb_panning:
                self.setDragMode(QGraphicsView.NoDrag)
                self.setCursor(Qt.ArrowCursor)
            event.accept()
            return
        super().keyReleaseEvent(event)

    # --- Mouse ---

    def mouseDoubleClickEvent(self, event):
        scene_pos = self.mapToScene(event.pos())
        item = self.scene().itemAt(scene_pos, self.transform())
        if item is None or not hasattr(item, "node_id"):
            if item and hasattr(item, "bridge_id"):
                self.cross_tree_bridge_activated.emit(item.bridge_id)
                event.accept()
                return
            types = NODE_TYPES_BY_TREE.get(self._active_tree, {"feature"})
            default_type = sorted(types)[0]
            self.node_create_requested.emit(default_type, "", scene_pos.x(), scene_pos.y())
            event.accept()
            return
        if hasattr(item, "node_id"):
            new_label, ok = QInputDialog.getText(
                None, "Редактировать узел", "Название:", text=item.node_label
            )
            if ok and new_label.strip():
                self.node_edit_requested.emit(item.node_id, "label", new_label.strip())
            event.accept()
            return
        super().mouseDoubleClickEvent(event)

    def mousePressEvent(self, event):
        if event.button() == Qt.MiddleButton:
            self._mmb_panning = True
            self._mmb_start_pos = event.pos()
            self.setCursor(Qt.ClosedHandCursor)
            self.setDragMode(QGraphicsView.ScrollHandDrag)
            super().mousePressEvent(event)
            return

        # Right button: defer between rubber-band and context menu.
        if event.button() == Qt.RightButton:
            self._rmb_press_pos = event.pos()
            self._rmb_rubber_active = False
            event.accept()
            return

        if event.button() == Qt.LeftButton and not self._space_pressed:
            scene_pos = self.mapToScene(event.pos())
            item = self.scene().itemAt(scene_pos, self.transform())
            # Any port can start an edge drag (4 ports, all bidirectional).
            if item and hasattr(item, "port_type") and hasattr(item, "side"):
                self._dragging_edge = True
                self._drag_source_port = item
                self._drag_source_node = item.parent_node
                from PySide6.QtWidgets import QGraphicsLineItem
                self._temp_line = QGraphicsLineItem()
                self._temp_line.setPen(QPen(QColor(SANTI), 2, Qt.DashLine))
                self._temp_line.setZValue(10)
                self.scene().addItem(self._temp_line)
                event.accept()
                return
            if item and hasattr(item, "node_id"):
                self.node_selected.emit(item.node_id)

        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        # Active edge drag — update the temporary line
        if self._dragging_edge and self._temp_line:
            start = self._drag_source_port.scene_center()
            end = self.mapToScene(event.pos())
            self._temp_line.setLine(start.x(), start.y(), end.x(), end.y())
            return

        # Track right-button movement → trigger rubber-band when threshold passed
        if self._rmb_press_pos is not None and (event.buttons() & Qt.RightButton):
            delta = event.pos() - self._rmb_press_pos
            if not self._rmb_rubber_active and (
                abs(delta.x()) > RMB_DRAG_THRESHOLD or abs(delta.y()) > RMB_DRAG_THRESHOLD
            ):
                self._rmb_rubber_active = True
                self._rmb_rubber.setGeometry(QRect(self._rmb_press_pos, QSize()))
                self._rmb_rubber.show()
            if self._rmb_rubber_active:
                rect = QRect(self._rmb_press_pos, event.pos()).normalized()
                self._rmb_rubber.setGeometry(rect)
            event.accept()
            return

        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MiddleButton:
            self._mmb_panning = False
            self.setDragMode(QGraphicsView.NoDrag)
            if not self._space_pressed:
                self.setCursor(Qt.ArrowCursor)
            event.accept()
            return

        # Right-button release: either finish rubber-band selection or open menu.
        if event.button() == Qt.RightButton:
            if self._rmb_rubber_active:
                rect_view = self._rmb_rubber.geometry()
                self._rmb_rubber.hide()
                self._rmb_rubber_active = False
                self._rmb_press_pos = None
                self._select_nodes_in_view_rect(rect_view, add_to_selection=bool(
                    event.modifiers() & Qt.ShiftModifier
                ))
                # If something got selected → show bulk menu, else canvas menu.
                selected_ids = self.get_selected_node_ids()
                if len(selected_ids) >= 2:
                    self._show_bulk_menu(event.globalPos(), selected_ids)
                event.accept()
                return
            # Plain right click (no drag) → existing context menu logic
            press_pos = self._rmb_press_pos
            self._rmb_press_pos = None
            scene_pos = self.mapToScene(press_pos if press_pos else event.pos())
            self._dispatch_context_menu(event, scene_pos)
            return

        if self._dragging_edge and event.button() == Qt.LeftButton:
            self._dragging_edge = False

            if self._temp_line:
                self.scene().removeItem(self._temp_line)
                self._temp_line = None

            scene_pos = self.mapToScene(event.pos())
            item = self.scene().itemAt(scene_pos, self.transform())
            target_node = None
            target_side = ""
            if item and hasattr(item, "port_type") and hasattr(item, "parent_node"):
                target_node = item.parent_node
                target_side = getattr(item, "side", "") or ""
            elif item and hasattr(item, "node_id"):
                target_node = item

            source_node = self._drag_source_node
            source_side = getattr(self._drag_source_port, "side", "") if self._drag_source_port else ""
            if target_node and not target_side:
                target_side = self._nearest_side_for_node(target_node, scene_pos)
            if source_node and target_node and source_node != target_node:
                self.edge_create_requested.emit(
                    source_node.node_id, target_node.node_id, source_side or "right", target_side or "left"
                )

            self._drag_source_port = None
            self._drag_source_node = None
            event.accept()
            return

        if self.dragMode() == QGraphicsView.ScrollHandDrag and not self._space_pressed and not self._mmb_panning:
            self.setDragMode(QGraphicsView.NoDrag)

        super().mouseReleaseEvent(event)

    def _nearest_side_for_node(self, node_item, scene_pos: QPointF) -> str:
        """Pick nearest face of a node to a given scene point."""
        try:
            w, h = node_item.box_size()
        except Exception:
            # Fallback to legacy dimensions
            br = node_item.boundingRect()
            w, h = br.width(), br.height()
        local = node_item.mapFromScene(scene_pos)
        d_top = abs(local.y() - 0)
        d_bottom = abs(h - local.y())
        d_left = abs(local.x() - 0)
        d_right = abs(w - local.x())
        distances = {
            "top": d_top,
            "bottom": d_bottom,
            "left": d_left,
            "right": d_right,
        }
        return min(distances, key=distances.get)

    def _select_nodes_in_view_rect(self, view_rect: QRect, add_to_selection: bool = False):
        """Select all BoxNodes whose scene rect intersects the rubber-band area."""
        scene = self.scene()
        if not add_to_selection:
            for it in scene.selectedItems():
                it.setSelected(False)
        scene_poly = self.mapToScene(view_rect)
        scene_rect = scene_poly.boundingRect()
        for item in scene.items():
            if not hasattr(item, "node_id") or not item.isVisible():
                continue
            if scene_rect.intersects(item.mapRectToScene(item.boundingRect())):
                item.setSelected(True)

    def _dispatch_context_menu(self, event, scene_pos):
        item = self.scene().itemAt(scene_pos, self.transform())
        if item and hasattr(item, "node_id"):
            selected = self.get_selected_node_ids()
            if len(selected) >= 2 and item.node_id in selected:
                self._show_bulk_menu(event.globalPos(), selected)
                return
            self._show_node_menu(event, item)
            return
        if item and hasattr(item, "edge_id"):
            self._show_edge_menu(event, item)
            return
        self._show_canvas_menu(event, scene_pos)

    # contextMenuEvent is intentionally NOT overridden: we drive menus
    # ourselves from mouseReleaseEvent so we can pre-empt with rubber-band.
    def contextMenuEvent(self, event):
        event.accept()

    def _show_canvas_menu(self, event, scene_pos):
        menu = QMenu(self)
        menu.setStyleSheet(self._menu_stylesheet())

        create_menu = menu.addMenu("✚  Создать узел")
        for nt in sorted(NODE_TYPES_BY_TREE.get(self._active_tree, {"feature"})):
            label = NODE_LABELS.get(nt, nt)
            action = create_menu.addAction(f"● {label}")
            action.triggered.connect(
                lambda checked=False, t=nt, x=scene_pos.x(), y=scene_pos.y():
                    self.node_create_requested.emit(t, "", x, y)
            )

        menu.addSeparator()
        fit_action = menu.addAction("⊞  Показать всё")
        fit_action.triggered.connect(self.fit_all)

        menu.exec(event.globalPos())

    def _show_node_menu(self, event, node_item):
        menu = QMenu(self)
        menu.setStyleSheet(self._menu_stylesheet())

        edit_label = menu.addAction("✏  Переименовать")
        edit_label.triggered.connect(
            lambda: self._edit_node_field(node_item.node_id, "label")
        )

        edit_desc = menu.addAction("📝  Описание")
        edit_desc.triggered.connect(
            lambda: self._edit_node_field(node_item.node_id, "description")
        )

        type_menu = menu.addMenu("🏷  Тип")
        for nt in sorted(NODE_TYPES_BY_TREE.get(self._active_tree, {"feature"})):
            label = NODE_LABELS.get(nt, nt)
            action = type_menu.addAction(f"● {label}")
            action.setCheckable(True)
            action.setChecked(nt == node_item.node_type)
            action.triggered.connect(
                lambda checked, nid=node_item.node_id, t=nt:
                    self.node_edit_requested.emit(nid, "type", t)
            )

        status_menu = menu.addMenu("⚖  Статус")
        current_status = getattr(node_item, '_status', 'draft')
        for st in NODE_STATUSES:
            label = NODE_STATUS_LABELS.get(st, st)
            action = status_menu.addAction(label)
            action.setCheckable(True)
            action.setChecked(st == current_status)
            action.triggered.connect(
                lambda checked, nid=node_item.node_id, s=st:
                    self.node_edit_requested.emit(nid, "status", s)
            )

        menu.addSeparator()

        style_menu = menu.addMenu("👁  Карточка")
        for label, attr in [
            ("Краткое описание", "show_description"),
            ("Плашки тегов", "show_tags"),
            ("Статус ИИ", "show_ai_status"),
        ]:
            action = style_menu.addAction(label)
            action.setCheckable(True)
            action.setChecked(getattr(node_item, attr, True))
            action.triggered.connect(
                lambda checked, n=node_item, a=attr: n.update_card_style(**{a: checked})
            )

        menu.addSeparator()

        del_action = menu.addAction("❌  Удалить узел")
        del_action.triggered.connect(
            lambda: self._confirm_delete_node(node_item.node_id)
        )

        menu.exec(event.globalPos())

    def _show_bulk_menu(self, global_pos, node_ids: list[str]):
        """Context menu for bulk operations on N selected nodes."""
        menu = QMenu(self)
        menu.setStyleSheet(self._menu_stylesheet())

        header = menu.addAction(f"Выбрано узлов: {len(node_ids)}")
        header.setEnabled(False)
        menu.addSeparator()

        type_menu = menu.addMenu("🏷  Изменить тип у всех")
        for nt in sorted(NODE_TYPES_BY_TREE.get(self._active_tree, {"feature"})):
            label = NODE_LABELS.get(nt, nt)
            action = type_menu.addAction(f"● {label}")
            action.triggered.connect(
                lambda checked=False, ids=list(node_ids), t=nt:
                    self.bulk_type_change_requested.emit(ids, t)
            )

        status_menu = menu.addMenu("⚖  Изменить статус у всех")
        for st in NODE_STATUSES:
            label = NODE_STATUS_LABELS.get(st, st)
            action = status_menu.addAction(label)
            action.triggered.connect(
                lambda checked=False, ids=list(node_ids), s=st:
                    self.bulk_status_change_requested.emit(ids, s)
            )

        menu.addSeparator()

        del_action = menu.addAction(f"❌  Удалить все ({len(node_ids)})")
        del_action.triggered.connect(
            lambda: self._confirm_bulk_delete(list(node_ids))
        )

        menu.exec(global_pos)

    def _confirm_bulk_delete(self, node_ids: list[str]):
        if ConfirmDialog.ask(
            self.window(),
            f"Удалить {len(node_ids)} узлов?",
            "Выбранные узлы и все связи между ними будут безвозвратно удалены.",
            confirm_text="Удалить",
            cancel_text="Отмена",
            icon="🗑",
            danger=True,
        ):
            self.bulk_delete_requested.emit(node_ids)

    def _show_edge_menu(self, event, edge_item):
        menu = QMenu(self)
        menu.setStyleSheet(self._menu_stylesheet())

        label_action = menu.addAction("✏  Подпись")
        label_action.triggered.connect(
            lambda: self._edit_edge_field(edge_item.edge_id, "label")
        )

        type_menu = menu.addMenu("🏷  Тип связи")
        for et, et_label in EDGE_TYPES.items():
            action = type_menu.addAction(et_label)
            action.triggered.connect(
                lambda checked, eid=edge_item.edge_id, t=et:
                    self.edge_edit_requested.emit(eid, "edge_type", t)
            )

        menu.addSeparator()

        del_action = menu.addAction("❌  Удалить связь")
        del_action.triggered.connect(
            lambda: self._confirm_delete_edge(edge_item.edge_id)
        )

        menu.exec(event.globalPos())

    def _edit_node_field(self, node_id: str, field: str):
        node_item = None
        for item in self.scene().items():
            if hasattr(item, "node_id") and item.node_id == node_id:
                node_item = item
                break
        if not node_item:
            return

        if field == "label":
            val, ok = QInputDialog.getText(None, "Название узла", "Название:",
                                           text=node_item.node_label)
            if ok and val.strip():
                self.node_edit_requested.emit(node_id, field, val.strip())
        elif field == "description":
            val, ok = QInputDialog.getText(None, "Описание узла", "Описание:",
                                           text=node_item.node_description)
            if ok:
                self.node_edit_requested.emit(node_id, field, val)

    def _edit_edge_field(self, edge_id: str, field: str):
        val, ok = QInputDialog.getText(None, "Подпись связи", "Подпись:", text="")
        if ok:
            self.edge_edit_requested.emit(edge_id, field, val)

    def _confirm_delete_node(self, node_id: str):
        if ConfirmDialog.ask(
            self.window(),
            "Удалить узел?",
            "Узел и все связанные с ним линии будут безвозвратно удалены.",
            confirm_text="Удалить",
            cancel_text="Отмена",
            icon="🗑",
            danger=True,
        ):
            self.node_delete_requested.emit(node_id)

    def _confirm_delete_edge(self, edge_id: str):
        if ConfirmDialog.ask(
            self.window(),
            "Удалить связь?",
            "Связь между узлами будет удалена. Узлы останутся на месте.",
            confirm_text="Удалить",
            cancel_text="Отмена",
            icon="🗑",
            danger=True,
        ):
            self.edge_delete_requested.emit(edge_id)

    def get_selected_node_ids(self) -> list[str]:
        return [
            item.node_id for item in self.scene().selectedItems()
            if hasattr(item, "node_id")
        ]

    def get_selected_edge_ids(self) -> list[str]:
        return [
            item.edge_id for item in self.scene().selectedItems()
            if hasattr(item, "edge_id")
        ]

    def select_all_nodes(self):
        for item in self.scene().items():
            if hasattr(item, "node_id"):
                item.setSelected(True)

    def count_nodes(self) -> int:
        return sum(1 for item in self.scene().items() if hasattr(item, "node_id"))

    def emit_empty_state(self):
        self.empty_changed.emit(self.count_nodes() == 0)
