"""EdgePath — a cubic Bezier curve connecting two nodes."""

from PySide6.QtWidgets import QGraphicsPathItem
from PySide6.QtGui import QPainter, QPen, QColor, QPainterPath
from PySide6.QtCore import QPointF, Qt

from src.utils.constants import SUBTEXT0


class EdgePath(QGraphicsPathItem):
    """Bezier curve between source and target ports."""

    def __init__(self, edge_id: str, source_node, target_node,
                 color: str = "#89b4fa", label: str = ""):
        super().__init__()
        self._edge_id = edge_id
        self._source = source_node
        self._target = target_node
        self._label = label
        self._color = QColor(color)
        self._hovered = False

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

    def update_path(self):
        """Recalculate the Bezier curve."""
        if not self._source or not self._target:
            return
        if not self._source.scene() or not self._target.scene():
            return

        p1 = self._source.get_output_port().scene_center()
        p2 = self._target.get_input_port().scene_center()

        dx = abs(p2.x() - p1.x())
        offset = max(dx * 0.5, 50)

        path = QPainterPath()
        path.moveTo(p1)
        path.cubicTo(
            QPointF(p1.x() + offset, p1.y()),
            QPointF(p2.x() - offset, p2.y()),
            p2,
        )
        self.setPath(path)

    def paint(self, painter: QPainter, option, widget=None):
        painter.setRenderHint(QPainter.Antialiasing)
        pen_width = 2.5 if self._hovered else 1.5
        pen = QPen(self._color, pen_width)
        pen.setCosmetic(True)
        painter.setPen(pen)
        painter.drawPath(self.path())

        # Draw label at midpoint
        if self._label:
            mid = self.path().pointAtPercent(0.5)
            painter.setPen(QColor(SUBTEXT0))
            painter.drawText(mid - QPointF(20, -12), self._label)

    def hoverEnterEvent(self, event):
        self._hovered = True
        self.update()
        super().hoverEnterEvent(event)

    def hoverLeaveEvent(self, event):
        self._hovered = False
        self.update()
        super().hoverLeaveEvent(event)

    def mousePressEvent(self, event):
        if event.button() == Qt.RightButton:
            # Delete edge on right-click
            scene = self.scene()
            if scene:
                scene.removeItem(self)
                # Notify engine via the scene's parent
                if hasattr(scene, 'parent') and scene.parent():
                    from PySide6.QtCore import QObject
                    QObject().deleteLater()
        super().mousePressEvent(event)
