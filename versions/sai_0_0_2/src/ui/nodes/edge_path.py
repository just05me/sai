"""EdgePath — orthogonal Manhattan routing with arrow at target."""

from PySide6.QtWidgets import QGraphicsPathItem, QGraphicsEllipseItem
from PySide6.QtGui import (
    QPainter, QPen, QColor, QPainterPath, QPolygonF, QBrush, QPainterPathStroker,
)
from PySide6.QtCore import QPointF, Qt, QRectF

from src.utils.constants import SANTI, EDGE_HITBOX, SUBTEXT0


def _manhattan_points(p1: QPointF, p2: QPointF, control_points: list = None) -> list[QPointF]:
    """Build orthogonal path points from source to target."""
    if control_points:
        pts = [p1] + [QPointF(cp["x"], cp["y"]) for cp in control_points] + [p2]
        return pts

    mid_x = (p1.x() + p2.x()) / 2
    return [p1, QPointF(mid_x, p1.y()), QPointF(mid_x, p2.y()), p2]


class EdgePath(QGraphicsPathItem):
    """Orthogonal edge with arrowhead at target."""

    def __init__(self, edge_id: str, source_node, target_node,
                 color: str = SANTI, label: str = "",
                 control_points: list = None):
        super().__init__()
        self._edge_id = edge_id
        self._source = source_node
        self._target = target_node
        self._label = label
        self._color = QColor(color)
        self._control_points = control_points or []
        self._hovered = False
        self._control_handles: list[QGraphicsEllipseItem] = []

        self.setPen(QPen(self._color, 2))
        self.setZValue(0)
        self.setFlag(QGraphicsPathItem.ItemIsSelectable, True)
        self.setAcceptHoverEvents(True)

        self.update_path()

    @property
    def edge_id(self) -> str:
        return self._edge_id

    @property
    def source_node(self):
        return self._source

    @property
    def target_node(self):
        return self._target

    def set_control_points(self, points: list):
        self._control_points = points
        self.update_path()

    def get_control_points(self) -> list[dict]:
        return [{"x": p.x(), "y": p.y()} for p in self._control_points]

    def update_path(self):
        if not self._source or not self._target:
            return
        if not self._source.scene() or not self._target.scene():
            return

        p1 = self._source.get_output_port().scene_center()
        p2 = self._target.get_input_port().scene_center()
        pts = _manhattan_points(p1, p2, self._control_points)

        path = QPainterPath()
        path.moveTo(pts[0])
        for pt in pts[1:]:
            path.lineTo(pt)
        self.setPath(path)

        self._rebuild_handles(pts[1:-1])

    def _rebuild_handles(self, bend_points: list[QPointF]):
        for h in self._control_handles:
            if h.scene():
                h.scene().removeItem(h)
        self._control_handles.clear()

        scene = self.scene()
        if scene is None:
            return

        for i, pt in enumerate(bend_points):
            handle = QGraphicsEllipseItem(-4, -4, 8, 8)
            handle.setBrush(QBrush(QColor(SANTI)))
            handle.setPen(QPen(QColor("white"), 1))
            handle.setPos(pt)
            handle.setZValue(5)
            handle.setVisible(False)
            handle.setFlag(handle.GraphicsItemFlag.ItemIsMovable, True)
            handle.setData(0, i)
            scene.addItem(handle)
            self._control_handles.append(handle)

    def shape(self):
        """Widen hit area to 6px for easier selection."""
        stroker = QPainterPathStroker()
        stroker.setWidth(EDGE_HITBOX)
        return stroker.createStroke(self.path())

    def paint(self, painter: QPainter, option, widget=None):
        painter.setRenderHint(QPainter.Antialiasing)
        pen_width = 2.5 if self._hovered or self.isSelected() else 2.0
        pen = QPen(self._color, pen_width)
        pen.setCosmetic(True)
        painter.setPen(pen)
        painter.drawPath(self.path())

        # Arrow at target
        pts = []
        for i in range(self.path().elementCount()):
            e = self.path().elementAt(i)
            pts.append(QPointF(e.x, e.y))
        if len(pts) >= 2:
            p_end = pts[-1]
            p_prev = pts[-2]
            dx = p_end.x() - p_prev.x()
            dy = p_end.y() - p_prev.y()
            if abs(dx) > abs(dy):
                direction = 1 if dx > 0 else -1
                arrow = QPolygonF([
                    p_end,
                    QPointF(p_end.x() - 8 * direction, p_end.y() - 4),
                    QPointF(p_end.x() - 8 * direction, p_end.y() + 4),
                ])
            else:
                direction = 1 if dy > 0 else -1
                arrow = QPolygonF([
                    p_end,
                    QPointF(p_end.x() - 4, p_end.y() - 8 * direction),
                    QPointF(p_end.x() + 4, p_end.y() - 8 * direction),
                ])
            painter.setBrush(self._color)
            painter.drawPolygon(arrow)

        if self._label:
            mid = self.path().pointAtPercent(0.5)
            painter.setPen(QColor(SUBTEXT0))
            painter.drawText(mid + QPointF(-20, -8), self._label)

        if self._hovered:
            for h in self._control_handles:
                h.setVisible(True)

    def hoverEnterEvent(self, event):
        self._hovered = True
        self.update()
        super().hoverEnterEvent(event)

    def hoverLeaveEvent(self, event):
        self._hovered = False
        for h in self._control_handles:
            h.setVisible(False)
        self.update()
        super().hoverLeaveEvent(event)
