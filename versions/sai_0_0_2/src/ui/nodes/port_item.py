"""PortItem — connection point on a BoxNode."""

from PySide6.QtWidgets import QGraphicsEllipseItem
from PySide6.QtGui import QBrush, QPen, QColor
from PySide6.QtCore import QRectF, QPointF, Qt

from src.utils.constants import PORT_RADIUS, SANTI


class PortItem(QGraphicsEllipseItem):
    """A small circle port for edge connections (input or output)."""

    def __init__(self, parent_node, port_type: str = "output", parent=None):
        r = PORT_RADIUS
        super().__init__(-r, -r, r * 2, r * 2, parent)
        self.parent_node = parent_node
        self.port_type = port_type
        self._hovered = False
        self._base_color = QColor(SANTI)
        self._hover_color = QColor("#a04d75")

        self.setBrush(QBrush(self._base_color))
        self.setPen(QPen(QColor("white"), 1.5))
        if port_type == "output":
            self.setCursor(Qt.CrossCursor)
            self.setToolTip("Потяни отсюда к другому узлу, чтобы создать связь")
        else:
            self.setCursor(Qt.PointingHandCursor)
            self.setToolTip("Перетащи сюда выходной порт другого узла")
        self.setZValue(3)
        self.setAcceptHoverEvents(True)
        self.setFlag(QGraphicsEllipseItem.ItemSendsScenePositionChanges, True)

    def scene_center(self) -> QPointF:
        return self.mapToScene(self.rect().center())

    def hoverEnterEvent(self, event):
        self._hovered = True
        self.setBrush(QBrush(self._hover_color))
        r = PORT_RADIUS + 2
        self.setRect(-r, -r, r * 2, r * 2)
        super().hoverEnterEvent(event)

    def hoverLeaveEvent(self, event):
        self._hovered = False
        self.setBrush(QBrush(self._base_color))
        r = PORT_RADIUS
        self.setRect(-r, -r, r * 2, r * 2)
        super().hoverLeaveEvent(event)

    def itemChange(self, change, value):
        if change == QGraphicsEllipseItem.ItemScenePositionHasChanged:
            self.parent_node.on_port_moved()
        return super().itemChange(change, value)
