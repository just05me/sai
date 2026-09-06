"""CrossTreeBridge — visual dashed bridge between trees on the canvas."""

from PySide6.QtWidgets import QGraphicsPathItem
from PySide6.QtGui import QPainter, QPen, QColor, QPainterPath, QFont, QFontMetrics
from PySide6.QtCore import QPointF, Qt, QRectF

from src.utils.constants import TEAL, SUBTEXT0, TREE_NAMES, PORT_RADIUS


BRIDGE_EXTENT = 140  # how far from node the bridge line extends
BRIDGE_COLOR = QColor(TEAL)


class CrossTreeBridge(QGraphicsPathItem):
    """A visual bridge from a node in one tree toward another tree."""

    def __init__(self, bridge_id: str, source_node, source_tree: str,
                 target_tree: str, target_node_id: str, label: str = ""):
        super().__init__()
        self._bridge_id = bridge_id
        self._source = source_node
        self._source_tree = source_tree
        self._target_tree = target_tree
        self._target_node_id = target_node_id
        self._label = label
        self._hovered = False

        self.setPen(QPen(BRIDGE_COLOR, 2, Qt.DashLine))
        self.setZValue(1)
        self.setFlag(QGraphicsPathItem.ItemIsSelectable, True)
        self.setAcceptHoverEvents(True)
        self.update_position()

    @property
    def bridge_id(self) -> str:
        return self._bridge_id

    @property
    def target_tree(self) -> str:
        return self._target_tree

    @property
    def target_node_id(self) -> str:
        return self._target_node_id

    @property
    def source_node(self):
        return self._source

    def update_position(self):
        if not self._source or not self._source.scene():
            return
        try:
            src_center = self._source.sceneBoundingRect().center()
        except RuntimeError:
            return

        # Extend to the right with a tree label
        end = QPointF(src_center.x() + BRIDGE_EXTENT, src_center.y())

        path = QPainterPath()
        path.moveTo(src_center)
        path.lineTo(end)
        self.setPath(path)
        self._end_point = end
        self._start_point = src_center

    def paint(self, painter: QPainter, option, widget=None):
        painter.setRenderHint(QPainter.Antialiasing)

        # Bridge line
        pen_width = 3 if self._hovered or self.isSelected() else 2
        pen = QPen(BRIDGE_COLOR, pen_width, Qt.DashLine)
        pen.setCosmetic(True)
        painter.setPen(pen)
        painter.drawPath(self.path())

        # Arrow tip
        if hasattr(self, "_end_point") and hasattr(self, "_start_point"):
            dx = self._end_point.x() - self._start_point.x()
            dy = self._end_point.y() - self._start_point.y()
            length = (dx ** 2 + dy ** 2) ** 0.5
            if length > 0:
                nx, ny = dx / length, dy / length
                px, py = -ny, nx
                tip = self._end_point
                base = QPointF(tip.x() - nx * 10, tip.y() - ny * 10)
                wing1 = QPointF(base.x() + px * 5, base.y() + py * 5)
                wing2 = QPointF(base.x() - px * 5, base.y() - py * 5)
                painter.setBrush(BRIDGE_COLOR)
                painter.drawPolygon([tip, wing1, wing2])

        # Label
        tree_label = TREE_NAMES.get(self._target_tree, self._target_tree)
        display = self._label or f"→ {tree_label}"
        font = QFont("Inter", 9)
        painter.setFont(font)
        painter.setPen(QColor(SUBTEXT0))
        if hasattr(self, "_end_point"):
            fm = QFontMetrics(font)
            tw = fm.horizontalAdvance(display)
            text_x = self._end_point.x() - tw - 16
            text_y = self._end_point.y() - 12
            painter.drawText(QPointF(text_x, text_y), display)

    def shape(self):
        stroker = self._make_stroker()
        return stroker.createStroke(self.path())

    @staticmethod
    def _make_stroker():
        from PySide6.QtGui import QPainterPathStroker
        s = QPainterPathStroker()
        s.setWidth(12)
        return s

    def hoverEnterEvent(self, event):
        self._hovered = True
        self.update()
        super().hoverEnterEvent(event)

    def hoverLeaveEvent(self, event):
        self._hovered = False
        self.update()
        super().hoverLeaveEvent(event)

    def boundingRect(self):
        base = super().boundingRect()
        return base.adjusted(-20, -30, 20, 30)
