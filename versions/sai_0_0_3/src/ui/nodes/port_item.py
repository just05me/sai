"""PortItem — connection point on a BoxNode (one of four sides)."""

from PySide6.QtWidgets import QGraphicsEllipseItem
from PySide6.QtGui import QBrush, QPen, QColor
from PySide6.QtCore import QPointF, Qt

from src.utils.constants import PORT_RADIUS, SANTI


PORT_SIDES = ("top", "right", "bottom", "left")


class PortItem(QGraphicsEllipseItem):
    """Bidirectional circular port. `side` identifies which face of the box."""

    def __init__(self, parent_node, side: str = "right", parent=None):
        if side not in PORT_SIDES:
            raise ValueError(f"Invalid port side: {side!r}")
        r = PORT_RADIUS
        super().__init__(-r, -r, r * 2, r * 2, parent)
        self.parent_node = parent_node
        self.side = side
        # Kept for legacy callers — every port is bidirectional now.
        self.port_type = "bi"
        self._hovered = False
        self._idle_collapsed = False
        self._idle_scale = 0.15  # 85% smaller in idle state
        self._base_color = QColor(SANTI)
        self._hover_color = QColor("#a04d75")

        self.setBrush(QBrush(self._base_color))
        self.setPen(QPen(QColor("white"), 1.5))
        self.setCursor(Qt.CrossCursor)
        self.setToolTip("Потяни отсюда к другому узлу, чтобы создать связь")
        self.setZValue(3)
        self.setAcceptHoverEvents(True)
        self.setFlag(QGraphicsEllipseItem.ItemSendsScenePositionChanges, True)
        self._apply_visual_state()

    def scene_center(self) -> QPointF:
        return self.mapToScene(self.rect().center())

    def _current_radius(self) -> float:
        r = PORT_RADIUS * (self._idle_scale if self._idle_collapsed else 1.0)
        if self._hovered and not self._idle_collapsed:
            r += 2
        return r

    def _apply_visual_state(self):
        self.setBrush(QBrush(self._hover_color if self._hovered else self._base_color))
        r = self._current_radius()
        self.setRect(-r, -r, r * 2, r * 2)

    def set_idle_collapsed(self, collapsed: bool):
        self._idle_collapsed = bool(collapsed)
        # Keep hover growth only in interactive mode.
        if self._idle_collapsed:
            self._hovered = False
        self._apply_visual_state()

    def hoverEnterEvent(self, event):
        self._hovered = True
        self._apply_visual_state()
        super().hoverEnterEvent(event)

    def hoverLeaveEvent(self, event):
        self._hovered = False
        self._apply_visual_state()
        super().hoverLeaveEvent(event)

    def itemChange(self, change, value):
        if change == QGraphicsEllipseItem.ItemScenePositionHasChanged:
            self.parent_node.on_port_moved()
        return super().itemChange(change, value)
