"""BoxNode — draggable card with states and customizable display."""

from PySide6.QtWidgets import QGraphicsItem, QInputDialog, QMenu
from PySide6.QtGui import (
    QPainter, QPen, QBrush, QColor, QFont, QPainterPath,
)
from PySide6.QtCore import QRectF, Qt

from src.ui.nodes.port_item import PortItem
from src.utils.constants import (
    NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, NODE_CORNER_RADIUS,
    NODE_COLORS, SURFACE0, TEXT, SUBTEXT0, SANTI, PORT_RADIUS,
)


FONT_LABEL = QFont("JetBrains Mono", 10, QFont.Bold)
FONT_DESC = QFont("JetBrains Mono", 8)
FONT_TAG = QFont("JetBrains Mono", 7)


class BoxNode(QGraphicsItem):
    """Canvas node card with ports and visual states."""

    def __init__(self, node_id: str, label: str = "Новый узел",
                 node_type: str = "feature", description: str = "",
                 width: int = NODE_DEFAULT_WIDTH, height: int = NODE_DEFAULT_HEIGHT,
                 show_description: bool = True, show_tags: bool = True,
                 show_ai_status: bool = True, generated_by: str = "user"):
        super().__init__()
        self._node_id = node_id
        self._label = label
        self._node_type = node_type
        self._description = description
        self._width = width
        self._height = height
        self._hovered = False
        self._selected = False
        self._thinking = False
        self._generated_by = generated_by

        self.show_description = show_description
        self.show_tags = show_tags
        self.show_ai_status = show_ai_status

        self.setFlag(QGraphicsItem.ItemIsMovable, True)
        self.setFlag(QGraphicsItem.ItemIsSelectable, True)
        self.setFlag(QGraphicsItem.ItemSendsGeometryChanges, True)
        self.setAcceptHoverEvents(True)
        self.setZValue(1)
        self.setCursor(Qt.OpenHandCursor)

        self._output_port = PortItem(self, "output", self)
        self._output_port.setPos(width + PORT_RADIUS, height / 2)
        self._input_port = PortItem(self, "input", self)
        self._input_port.setPos(-PORT_RADIUS, height / 2)

        self._border_color = QColor(NODE_COLORS.get(node_type, SANTI))
        self._ai_opacity = 1.0

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
        self.prepareGeometryChange()

    def update_card_style(self, show_description: bool = None, show_tags: bool = None,
                          show_ai_status: bool = None):
        if show_description is not None:
            self.show_description = show_description
        if show_tags is not None:
            self.show_tags = show_tags
        if show_ai_status is not None:
            self.show_ai_status = show_ai_status
        self.update()

    def set_thinking(self, active: bool):
        self._thinking = active
        self._ai_opacity = 0.6 if active else 1.0
        self.update()

    def set_highlight(self, active: bool):
        self._selected = active
        self.update()

    def boundingRect(self) -> QRectF:
        margin = 20
        return QRectF(-margin, -margin, self._width + 2 * margin, self._height + 2 * margin)

    def paint(self, painter: QPainter, option, widget=None):
        painter.setRenderHint(QPainter.Antialiasing)

        rect = QRectF(0, 0, self._width, self._height)
        path = QPainterPath()
        path.addRoundedRect(rect, NODE_CORNER_RADIUS, NODE_CORNER_RADIUS)
        painter.fillPath(path, QBrush(QColor(SURFACE0)))

        if self._hovered and not self._selected:
            shadow = QPainterPath()
            shadow.addRoundedRect(QRectF(2, 2, self._width, self._height),
                                  NODE_CORNER_RADIUS, NODE_CORNER_RADIUS)
            painter.fillPath(shadow, QColor(116, 51, 84, 40))

        border_color = QColor(SANTI) if self._selected else (
            QColor(SANTI) if self._hovered else QColor("#181825")
        )
        pen_width = 2.0 if (self._selected or self._hovered) else 1.5
        painter.setPen(QPen(border_color, pen_width))
        painter.drawPath(path)

        painter.setPen(QColor(TEXT))
        painter.setFont(FONT_LABEL)
        y = 10
        painter.drawText(QRectF(12, y, self._width - 24, 22),
                         Qt.AlignLeft | Qt.AlignVCenter, self._label[:40])
        y += 24

        if self.show_description and self._description:
            painter.setPen(QColor(SUBTEXT0))
            painter.setFont(FONT_DESC)
            desc = self._description[:50] + ("…" if len(self._description) > 50 else "")
            painter.drawText(QRectF(12, y, self._width - 24, 18),
                             Qt.AlignLeft | Qt.AlignVCenter, desc)
            y += 20

        if self.show_tags:
            painter.setFont(FONT_TAG)
            tag_y = self._height - 22
            painter.setPen(QColor(SUBTEXT0))
            painter.drawText(QRectF(12, tag_y, self._width - 24, 16),
                             Qt.AlignLeft | Qt.AlignVCenter, f"● {self._node_type}")

        if self.show_ai_status and self._generated_by == "ai":
            painter.setPen(QColor(SANTI))
            painter.setFont(FONT_TAG)
            opacity = self._ai_opacity if self._thinking else 1.0
            painter.setOpacity(opacity)
            painter.drawText(QRectF(self._width - 40, 8, 30, 16),
                             Qt.AlignRight | Qt.AlignVCenter, "⚡ ИИ")
            painter.setOpacity(1.0)

    def itemChange(self, change, value):
        if change == QGraphicsItem.ItemPositionHasChanged:
            self._notify_edges()
        if change == QGraphicsItem.ItemSelectedHasChanged:
            self._selected = bool(value)
            self.update()
        return super().itemChange(change, value)

    def _notify_edges(self):
        for item in self.scene().items() if self.scene() else []:
            if hasattr(item, "update_path"):
                item.update_path()

    def hoverEnterEvent(self, event):
        self._hovered = True
        self.update()
        super().hoverEnterEvent(event)

    def hoverLeaveEvent(self, event):
        self._hovered = False
        self.update()
        super().hoverLeaveEvent(event)

    def mousePressEvent(self, event):
        self.setCursor(Qt.ClosedHandCursor)
        super().mousePressEvent(event)

    def mouseReleaseEvent(self, event):
        self.setCursor(Qt.OpenHandCursor)
        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event):
        new_label, ok = QInputDialog.getText(
            None, "Редактировать узел", "Название:", text=self._label
        )
        if ok and new_label.strip():
            self._label = new_label.strip()
            self.update()
        super().mouseDoubleClickEvent(event)
