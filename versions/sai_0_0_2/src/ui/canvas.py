"""InfiniteCanvas — QGraphicsView with dot grid, zoom, pan, node creation."""

import math

from PySide6.QtWidgets import QGraphicsView, QGraphicsScene, QMenu, QInputDialog, QMessageBox
from PySide6.QtGui import QPainter, QPen, QColor, QBrush, QKeyEvent
from PySide6.QtCore import Qt, QPointF, Signal, QRectF

from src.utils.constants import (
    BASE, LIGHT_BASE, LIGHT_MANTLE, LIGHT_TEXT, LIGHT_SURFACE1,
    TEXT, MANTLE, SURFACE0,
    GRID_SIZE, SCENE_SIZE,
    ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, NODE_TYPES_BY_TREE, NODE_LABELS,
    GRID_DOT_DARK, GRID_DOT_LIGHT, SANTI,
)


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
    """Main canvas: zoom, pan (Space+LMB), double-click to create node."""

    node_create_requested = Signal(str, str, float, float)
    edge_create_requested = Signal(str, str)
    node_delete_requested = Signal(str)
    edge_delete_requested = Signal(str)
    node_selected = Signal(str)
    empty_changed = Signal(bool)

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
        self._dragging_edge = False
        self._drag_source_port = None
        self._drag_source_node = None
        self._temp_line = None
        self._active_tree = "functional"
        self._engine = None
        self._is_dark = True

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
        """

    def wheelEvent(self, event):
        delta = event.angleDelta().y()
        factor = ZOOM_STEP if delta > 0 else 1 / ZOOM_STEP
        current = self.transform().m11()
        if ZOOM_MIN < current * factor < ZOOM_MAX:
            self.scale(factor, factor)

    def keyPressEvent(self, event: QKeyEvent):
        if event.key() == Qt.Key_Space and not event.isAutoRepeat():
            self._space_pressed = True
            self.setDragMode(QGraphicsView.ScrollHandDrag)
            self.setCursor(Qt.ClosedHandCursor)
            event.accept()
            return
        super().keyPressEvent(event)

    def keyReleaseEvent(self, event: QKeyEvent):
        if event.key() == Qt.Key_Space and not event.isAutoRepeat():
            self._space_pressed = False
            self.setDragMode(QGraphicsView.NoDrag)
            self.setCursor(Qt.ArrowCursor)
            event.accept()
            return
        super().keyReleaseEvent(event)

    def mouseDoubleClickEvent(self, event):
        scene_pos = self.mapToScene(event.pos())
        item = self.scene().itemAt(scene_pos, self.transform())
        if item is None or not hasattr(item, "node_id"):
            types = NODE_TYPES_BY_TREE.get(self._active_tree, {"feature"})
            default_type = sorted(types)[0]
            self.node_create_requested.emit(default_type, "", scene_pos.x(), scene_pos.y())
            event.accept()
            return
        super().mouseDoubleClickEvent(event)

    def contextMenuEvent(self, event):
        scene_pos = self.mapToScene(event.pos())
        item = self.scene().itemAt(scene_pos, self.transform())

        if item and hasattr(item, "node_id"):
            self._show_node_menu(event, item)
            return

        menu = QMenu(self)
        menu.setStyleSheet(self._menu_stylesheet())

        create_menu = menu.addMenu("Создать узел")
        for nt in sorted(NODE_TYPES_BY_TREE.get(self._active_tree, {"feature"})):
            label = NODE_LABELS.get(nt, nt)
            action = create_menu.addAction(f"● {label}")
            action.triggered.connect(
                lambda checked=False, t=nt, x=scene_pos.x(), y=scene_pos.y():
                    self.node_create_requested.emit(t, "", x, y)
            )
        menu.exec(event.globalPos())

    def _show_node_menu(self, event, node_item):
        menu = QMenu(self)
        menu.setStyleSheet(self._menu_stylesheet())

        style_menu = menu.addMenu("Карточка")
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

        delete_action = menu.addAction("❌  Удалить")
        delete_action.triggered.connect(
            lambda: self._confirm_delete_node(node_item.node_id)
        )
        menu.exec(event.globalPos())

    def _confirm_delete_node(self, node_id: str):
        reply = QMessageBox.question(
            self, "Удалить узел",
            "Удалить этот узел и все связанные линии?",
            QMessageBox.Yes | QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            self.node_delete_requested.emit(node_id)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton and not self._space_pressed:
            scene_pos = self.mapToScene(event.pos())
            item = self.scene().itemAt(scene_pos, self.transform())
            if item and hasattr(item, "port_type"):
                if item.port_type == "output":
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
        elif event.button() == Qt.MiddleButton or (event.button() == Qt.LeftButton and self._space_pressed):
            self.setDragMode(QGraphicsView.ScrollHandDrag)

        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self._dragging_edge and self._temp_line:
            start = self._drag_source_port.scene_center()
            end = self.mapToScene(event.pos())
            self._temp_line.setLine(start.x(), start.y(), end.x(), end.y())
            return
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        if self._dragging_edge and event.button() == Qt.LeftButton:
            self._dragging_edge = False

            if self._temp_line:
                self.scene().removeItem(self._temp_line)
                self._temp_line = None

            scene_pos = self.mapToScene(event.pos())
            item = self.scene().itemAt(scene_pos, self.transform())
            target_node = None
            if item and hasattr(item, "port_type") and item.port_type == "input":
                target_node = item.parent_node
            elif item and hasattr(item, "node_id"):
                target_node = item
            elif item and hasattr(item, "parent_node"):
                target_node = item.parent_node

            source_node = self._drag_source_node
            if source_node and target_node and source_node != target_node:
                self.edge_create_requested.emit(
                    source_node.node_id, target_node.node_id
                )

            self._drag_source_port = None
            self._drag_source_node = None
            event.accept()
            return

        if self.dragMode() == QGraphicsView.ScrollHandDrag and not self._space_pressed:
            self.setDragMode(QGraphicsView.NoDrag)

        super().mouseReleaseEvent(event)

    def count_nodes(self) -> int:
        return sum(1 for item in self.scene().items() if hasattr(item, "node_id"))

    def emit_empty_state(self):
        self.empty_changed.emit(self.count_nodes() == 0)
