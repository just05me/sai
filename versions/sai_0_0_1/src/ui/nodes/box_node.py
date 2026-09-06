"""BoxNode — a draggable card on the canvas representing a function/task/etc."""

from PySide6.QtWidgets import (
    QGraphicsItem, QGraphicsTextItem, QInputDialog, QMenu,
)
from PySide6.QtGui import (
    QPainter, QPen, QBrush, QColor, QFont, QPainterPath,
)
from PySide6.QtCore import QRectF, QPointF, Qt, QRect

from src.ui.nodes.port_item import PortItem
from src.utils.constants import (
    NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, NODE_CORNER_RADIUS,
    NODE_COLORS, BASE, SURFACE0, TEXT, SUBTEXT0, SURFACE1,
)

FONT_LABEL = QFont("sans-serif", 11, QFont.Bold)
FONT_TYPE = QFont("sans-serif", 8)


class BoxNode(QGraphicsItem):
    """A card on the canvas. Draggable, with input/output ports."""

    def __init__(self, node_id: str, label: str = "Новый узел",
                 node_type: str = "feature", description: str = "",
                 width: int = NODE_DEFAULT_WIDTH, height: int = NODE_DEFAULT_HEIGHT):
        super().__init__()
        self._node_id = node_id
        self._label = label
        self._node_type = node_type
        self._description = description
        self._width = width
        self._height = height
        self._highlight = False

        self.setFlag(QGraphicsItem.ItemIsMovable, True)
        self.setFlag(QGraphicsItem.ItemIsSelectable, True)
        self.setFlag(QGraphicsItem.ItemSendsGeometryChanges, True)
        self.setZValue(1)
        self.setCursor(Qt.OpenHandCursor)

        # Create ports
        self._output_port = PortItem(self, "output", self)
        self._output_port.setPos(width + PORT_RADIUS, height / 2)
        self._input_port = PortItem(self, "input", self)
        self._input_port.setPos(-PORT_RADIUS, height / 2)

        # Cache color
        self._border_color = QColor(NODE_COLORS.get(node_type, "#89b4fa"))

    @property
    def node_id(self) -> str:
        return self._node_id

    @property
    def node_label(self) -> str:
        return self._label

    @node_label.setter
    def node_label(self, val: str):
        self._label = val
        self.update()

    @property
    def node_type(self) -> str:
        return self._node_type

    @property
    def node_description(self) -> str:
        return self._description

    def get_output_port(self) -> PortItem:
        return self._output_port

    def get_input_port(self) -> PortItem:
        return self._input_port

    def on_port_moved(self):
        """Called when a port changes position (trigger edge redraw)."""
        self.prepareGeometryChange()

    def boundingRect(self) -> QRectF:
        margin = 20
        return QRectF(-margin, -margin,
                      self._width + 2 * margin,
                      self._height + 2 * margin)

    def paint(self, painter: QPainter, option, widget=None):
        painter.setRenderHint(QPainter.Antialiasing)

        # Shadow
        shadow_rect = QRectF(3, 3, self._width, self._height)
        path_shadow = QPainterPath()
        path_shadow.addRoundedRect(shadow_rect, NODE_CORNER_RADIUS, NODE_CORNER_RADIUS)
        painter.fillPath(path_shadow, QColor(0, 0, 0, 40))

        # Background
        rect = QRectF(0, 0, self._width, self._height)
        path = QPainterPath()
        path.addRoundedRect(rect, NODE_CORNER_RADIUS, NODE_CORNER_RADIUS)
        painter.fillPath(path, QBrush(QColor(SURFACE0)))

        # Border
        pen_width = 2 if self._highlight else 1.5
        painter.setPen(QPen(self._border_color, pen_width))
        painter.drawPath(path)

        # Type badge (top-left colored strip)
        badge_rect = QRectF(0, 0, 4, self._height)
        badge_path = QPainterPath()
        badge_path.addRoundedRect(badge_rect, NODE_CORNER_RADIUS, NODE_CORNER_RADIUS)
        # Clip to left edge only
        painter.setClipRect(QRectF(0, 0, NODE_CORNER_RADIUS + 2, self._height))
        painter.fillPath(badge_path, QBrush(self._border_color))
        painter.setClipping(False)

        # Label
        painter.setPen(QColor(TEXT))
        painter.setFont(FONT_LABEL)
        text_rect = QRectF(14, 8, self._width - 24, 22)
        painter.drawText(text_rect, Qt.AlignLeft | Qt.AlignVCenter,
                         self._label[:30])

        # Description (truncated)
        if self._description:
            painter.setPen(QColor(SUBTEXT0))
            painter.setFont(FONT_TYPE)
            desc = self._description[:50] + ("…" if len(self._description) > 50 else "")
            desc_rect = QRectF(14, 30, self._width - 24, 18)
            painter.drawText(desc_rect, Qt.AlignLeft | Qt.AlignVCenter, desc)

        # Type label at bottom
        painter.setPen(QColor(SUBTEXT0))
        painter.setFont(FONT_TYPE)
        type_rect = QRectF(14, self._height - 20, self._width - 24, 16)
        painter.drawText(type_rect, Qt.AlignLeft | Qt.AlignVCenter,
                         f"● {self._node_type}")

    def itemChange(self, change, value):
        if change == QGraphicsItem.ItemPositionHasChanged:
            self._notify_edges()
        if change == QGraphicsItem.ItemSelectedHasChanged:
            self._highlight = bool(value)
            self.update()
        return super().itemChange(change, value)

    def _notify_edges(self):
        """Notify connected edges to redraw."""
        for item in self.scene().items() if self.scene() else []:
            if hasattr(item, 'update_path') and callable(item.update_path):
                item.update_path()

    def mousePressEvent(self, event):
        self.setCursor(Qt.ClosedHandCursor)
        super().mousePressEvent(event)

    def mouseReleaseEvent(self, event):
        self.setCursor(Qt.OpenHandCursor)
        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event):
        """Double-click to edit label inline."""
        new_label, ok = QInputDialog.getText(
            None, "Редактировать узел", "Название:",
            text=self._label
        )
        if ok and new_label.strip():
            self._label = new_label.strip()
            self.update()
        super().mouseDoubleClickEvent(event)
