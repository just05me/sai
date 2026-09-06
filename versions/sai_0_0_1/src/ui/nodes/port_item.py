"""PortItem — connection point on a BoxNode."""

from PySide6.QtWidgets import QGraphicsEllipseItem
from PySide6.QtGui import QBrush, QPen
from PySide6.QtCore import QRectF, QPointF, Qt

from src.utils.constants import PORT_RADIUS, SURFACE2, TEXT


class PortItem(QGraphicsEllipseItem):
    """A small circle port for edge connections (input or output)."""

    def __init__(self, parent_node, port_type: str = "output", parent=None):
        r = PORT_RADIUS
        super().__init__(-r, -r, r * 2, r * 2, parent)
        self.parent_node = parent_node
        self.port_type = port_type  # "input" or "output"
        self.setBrush(QBrush(SURFACE2))
        self.setPen(QPen(TEXT, 1))
        self.setCursor(Qt.CrossCursor)
        self.setZValue(2)
        self.setFlag(QGraphicsEllipseItem.ItemSendsScenePositionChanges, True)

    def scene_center(self) -> QPointF:
        return self.mapToScene(self.rect().center())

    def itemChange(self, change, value):
        if change == QGraphicsEllipseItem.ItemScenePositionHasChanged:
            self.parent_node.on_port_moved()
        return super().itemChange(change, value)
