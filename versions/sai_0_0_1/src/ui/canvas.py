"""InfiniteCanvas — QGraphicsView with zoom, pan, and dot-grid background."""

import math

from PySide6.QtWidgets import (
    QGraphicsView, QGraphicsScene, QMenu, QInputDialog,
)
from PySide6.QtGui import QPainter, QPen, QColor, QBrush
from PySide6.QtCore import Qt, QPointF, Signal, QRectF

from src.utils.constants import (
    BASE, SURFACE0, SURFACE1, GRID_SIZE, SCENE_SIZE,
    ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, NODE_TYPES_BY_TREE, NODE_LABELS,
)


class CanvasScene(QGraphicsScene):
    """Scene with Catppuccin-themed dot-grid background."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setSceneRect(-SCENE_SIZE / 2, -SCENE_SIZE / 2, SCENE_SIZE, SCENE_SIZE)
        self._grid_size = GRID_SIZE
        self._grid_pen_major = QPen(QColor(SURFACE0), 1)
        self._grid_pen_major.setCosmetic(True)
        self._grid_pen_minor = QPen(QColor("#262637"), 1)
        self._grid_pen_minor.setCosmetic(True)

    def drawBackground(self, painter: QPainter, rect: QRectF):
        """Draw the dot grid. Only draws visible area for performance."""
        painter.fillRect(rect, QColor(BASE))

        left = math.floor(rect.left() / self._grid_size) * self._grid_size
        top = math.floor(rect.top() / self._grid_size) * self._grid_size

        # Minor grid lines
        painter.setPen(self._grid_pen_minor)
        x = left
        while x < rect.right():
            painter.drawLine(QPointF(x, rect.top()), QPointF(x, rect.bottom()))
            x += self._grid_size
        y = top
        while y < rect.bottom():
            painter.drawLine(QPointF(rect.left(), y), QPointF(rect.right(), y))
            y += self._grid_size

        # Major grid lines (every 5th)
        painter.setPen(self._grid_pen_major)
        x = left
        while x < rect.right():
            if int(x / self._grid_size) % 5 == 0:
                painter.drawLine(QPointF(x, rect.top()), QPointF(x, rect.bottom()))
            x += self._grid_size
        y = top
        while y < rect.bottom():
            if int(y / self._grid_size) % 5 == 0:
                painter.drawLine(QPointF(rect.left(), y), QPointF(rect.right(), y))
            y += self._grid_size


class InfiniteCanvas(QGraphicsView):
    """The main canvas view with zoom, pan, and context menu."""

    node_create_requested = Signal(str, str, float, float)  # type, label, x, y
    edge_create_requested = Signal(str, str)  # source_id, target_id
    canvas_clicked = Signal(float, float)  # x, y (empty area clicked)

    def __init__(self, scene: QGraphicsScene, parent=None):
        super().__init__(scene, parent)

        # Render hints
        self.setRenderHint(QPainter.Antialiasing)
        self.setRenderHint(QPainter.SmoothPixmapTransform)
        self.setRenderHint(QPainter.TextAntialiasing)

        # No scrollbars
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)

        # Drag mode for panning
        self.setDragMode(QGraphicsView.ScrollHandDrag)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)
        self.setViewportUpdateMode(QGraphicsView.MinimalViewportUpdate)
        self.setOptimizationFlag(QGraphicsView.DontAdjustForAntialiasing, True)

        # Edge creation state
        self._dragging_edge = False
        self._drag_source_port = None
        self._drag_source_node = None
        self._temp_line = None
        self._active_tree = "functional"

        self.setStyleSheet("border: none; background: transparent;")

    def set_active_tree(self, tree_name: str):
        self._active_tree = tree_name

    def wheelEvent(self, event):
        """Zoom in/out centered on cursor position."""
        delta = event.angleDelta().y()
        factor = ZOOM_STEP if delta > 0 else 1 / ZOOM_STEP

        current = self.transform().m11()
        if ZOOM_MIN < current * factor < ZOOM_MAX:
            self.scale(factor, factor)

    def contextMenuEvent(self, event):
        """Right-click menu on the canvas."""
        scene_pos = self.mapToScene(event.pos())
        item = self.scene().itemAt(scene_pos, self.transform())

        # If clicked on an item, show node context menu
        if item and hasattr(item, 'node_id'):
            self._show_node_menu(event, item)
            return

        # Otherwise, show canvas creation menu
        menu = QMenu(self)
        types = NODE_TYPES_BY_TREE.get(self._active_tree, {"feature"})

        create_menu = menu.addMenu("Создать узел")
        for nt in sorted(types):
            label = NODE_LABELS.get(nt, nt)
            action = create_menu.addAction(f"● {label}")
            action.triggered.connect(
                lambda checked=False, t=nt, x=scene_pos.x(), y=scene_pos.y():
                    self.node_create_requested.emit(t, "", x, y)
            )

        menu.exec(event.globalPos())

    def _show_node_menu(self, event, node_item):
        """Context menu for a specific node."""
        menu = QMenu(self)
        menu.addAction("✏️  Редактировать")
        menu.addAction("❌  Удалить")
        # Could add more actions here
        menu.exec(event.globalPos())

    def mousePressEvent(self, event):
        """Handle edge creation start on port click."""
        if event.button() == Qt.LeftButton:
            item = self.itemAt(event.pos())
            if item and hasattr(item, 'port_type'):
                # Starting an edge from a port
                if item.port_type == "output":
                    self._dragging_edge = True
                    self._drag_source_port = item
                    self._drag_source_node = item.parent_node
                    self.setDragMode(QGraphicsView.NoDrag)
                    # Create temp line
                    from PySide6.QtWidgets import QGraphicsLineItem
                    self._temp_line = QGraphicsLineItem()
                    self._temp_line.setPen(QPen(QColor("#89b4fa"), 2, Qt.DashLine))
                    self._temp_line.setZValue(10)
                    self.scene().addItem(self._temp_line)
                    return

        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        """Update temp line during edge drag."""
        if self._dragging_edge and self._temp_line:
            start = self._drag_source_port.scene_center()
            end = self.mapToScene(event.pos())
            self._temp_line.setLine(start.x(), start.y(), end.x(), end.y())
            return
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        """Finish edge creation on port drop."""
        if self._dragging_edge and event.button() == Qt.LeftButton:
            self._dragging_edge = False
            self.setDragMode(QGraphicsView.ScrollHandDrag)

            if self._temp_line:
                self.scene().removeItem(self._temp_line)
                self._temp_line = None

            # Check if dropped on an input port
            item = self.itemAt(event.pos())
            if item and hasattr(item, 'port_type') and item.port_type == "input":
                target_node = item.parent_node
                source_node = self._drag_source_node
                if source_node and target_node and source_node != target_node:
                    self.edge_create_requested.emit(
                        source_node.node_id, target_node.node_id
                    )

            self._drag_source_port = None
            self._drag_source_node = None
            return

        super().mouseReleaseEvent(event)
