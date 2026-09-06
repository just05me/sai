"""BoxNode — draggable card with 4 ports and collision-aware positioning."""

from PySide6.QtWidgets import QGraphicsItem
from PySide6.QtGui import (
    QPainter, QPen, QBrush, QColor, QFont, QPainterPath,
)
from PySide6.QtCore import QRectF, Qt, QPointF

from src.ui.nodes.port_item import PortItem
from src.utils.constants import (
    NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, NODE_CORNER_RADIUS,
    NODE_COLORS, SURFACE0, TEXT, SUBTEXT0, SANTI, PORT_RADIUS, GRID_SIZE,
)


FONT_LABEL = QFont("JetBrains Mono", 10, QFont.Bold)
FONT_DESC = QFont("JetBrains Mono", 8)
FONT_TAG = QFont("JetBrains Mono", 7)

# How far to leave between boxes when collision-resolving a drag.
HITBOX_GAP = 6


class BoxNode(QGraphicsItem):
    """Canvas node card with 4 ports and visual states."""

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
        self._pressed = False
        self._thinking = False
        self._generated_by = generated_by
        self._status = "draft"
        self._description_missing = not bool((description or "").strip())

        self.show_description = show_description
        self.show_tags = show_tags
        self.show_ai_status = show_ai_status

        self.setFlag(QGraphicsItem.ItemIsMovable, True)
        self.setFlag(QGraphicsItem.ItemIsSelectable, True)
        self.setFlag(QGraphicsItem.ItemSendsGeometryChanges, True)
        self.setAcceptHoverEvents(True)
        self.setZValue(1)
        self.setCursor(Qt.OpenHandCursor)

        self._ports: dict[str, PortItem] = {}
        for side in ("top", "right", "bottom", "left"):
            port = PortItem(self, side, self)
            self._ports[side] = port
        self._position_ports()
        self._update_ports_visual_state()

        self._border_color = QColor(NODE_COLORS.get(node_type, SANTI))
        self._ai_opacity = 1.0

    def _position_ports(self):
        """Place the 4 ports exactly on top/right/bottom/left edges."""
        w, h = self._width, self._height
        self._ports["top"].setPos(w / 2, -PORT_RADIUS)
        self._ports["right"].setPos(w + PORT_RADIUS, h / 2)
        self._ports["bottom"].setPos(w / 2, h + PORT_RADIUS)
        self._ports["left"].setPos(-PORT_RADIUS, h / 2)

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

    def get_port(self, side: str) -> PortItem:
        return self._ports[side]

    def get_ports(self) -> dict[str, PortItem]:
        return self._ports

    def get_output_port(self) -> PortItem:
        """Legacy: returns the right port; edge code now picks dynamically."""
        return self._ports["right"]

    def get_input_port(self) -> PortItem:
        """Legacy: returns the left port; edge code now picks dynamically."""
        return self._ports["left"]

    def on_port_moved(self):
        self.prepareGeometryChange()

    def _update_ports_visual_state(self):
        """Collapse ports in idle, restore while interacting with this node."""
        interactive = self._hovered or self._selected or self._pressed
        for port in self._ports.values():
            port.set_idle_collapsed(not interactive)

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
        self._update_ports_visual_state()
        self.update()

    def set_description(self, desc: str):
        self._description = desc
        self._description_missing = not bool((desc or "").strip())
        self.update()

    def set_node_type(self, ntype: str):
        self._node_type = ntype
        self._border_color = QColor(NODE_COLORS.get(ntype, SANTI))
        self.update()

    def set_status(self, status: str):
        self._status = status
        self.update()

    @property
    def node_status(self) -> str:
        return getattr(self, '_status', 'draft')

    def boundingRect(self) -> QRectF:
        margin = PORT_RADIUS + 4
        return QRectF(-margin, -margin,
                      self._width + 2 * margin, self._height + 2 * margin)

    def box_scene_rect(self) -> QRectF:
        """Tight bounding rect of the visible card (no port padding) in scene coords."""
        return self.mapRectToScene(QRectF(0, 0, self._width, self._height))

    def box_size(self) -> tuple[float, float]:
        return self._width, self._height

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

        # Colored title bar to read better in the minimap & at zoom
        title_h = 22
        title_rect = QRectF(0, 0, self._width, title_h)
        title_path = QPainterPath()
        title_path.addRoundedRect(title_rect, NODE_CORNER_RADIUS, NODE_CORNER_RADIUS)
        accent = QColor(NODE_COLORS.get(self._node_type, SANTI))
        accent.setAlpha(70)
        painter.fillPath(title_path, accent)

        painter.setPen(QColor(TEXT))
        painter.setFont(FONT_LABEL)
        painter.drawText(QRectF(12, 0, self._width - 24, title_h),
                         Qt.AlignLeft | Qt.AlignVCenter, self._label[:40])
        y = title_h + 4

        if self.show_description and self._description:
            painter.setPen(QColor(SUBTEXT0))
            painter.setFont(FONT_DESC)
            desc = self._description[:60] + ("…" if len(self._description) > 60 else "")
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
            painter.drawText(QRectF(self._width - 40, 4, 30, 16),
                             Qt.AlignRight | Qt.AlignVCenter, "⚡ ИИ")
            painter.setOpacity(1.0)

        if self._description_missing:
            painter.setBrush(QColor("#e64553"))
            painter.setPen(Qt.NoPen)
            painter.drawEllipse(QRectF(self._width - 14, self._height - 14, 8, 8))

    def _resolve_collision(self, target: QPointF) -> QPointF:
        """Return a position close to `target` that does not overlap any sibling.

        Strategy: try the full target, then partial moves (only-X / only-Y),
        then fall back to current position. Honors HITBOX_GAP padding.
        """
        scene = self.scene()
        if scene is None:
            return target

        # During a group drag let Qt move everything together — only ensure no
        # collision with nodes that are *not* part of the current selection.
        selected = {it for it in scene.selectedItems() if isinstance(it, BoxNode)}
        ignore = selected if (self in selected and len(selected) > 1) else set()
        ignore.add(self)

        others: list[QRectF] = []
        for item in scene.items():
            if not isinstance(item, BoxNode) or item in ignore:
                continue
            if not item.isVisible():
                continue
            others.append(item.box_scene_rect().adjusted(
                -HITBOX_GAP, -HITBOX_GAP, HITBOX_GAP, HITBOX_GAP
            ))

        if not others:
            return target

        def fits(pos: QPointF) -> bool:
            r = QRectF(pos.x(), pos.y(), self._width, self._height)
            return not any(r.intersects(o) for o in others)

        if fits(target):
            return target

        current = self.pos()
        # Try axis-only moves to slide along an obstacle
        only_x = QPointF(target.x(), current.y())
        if fits(only_x):
            return only_x
        only_y = QPointF(current.x(), target.y())
        if fits(only_y):
            return only_y
        return current

    def itemChange(self, change, value):
        if change == QGraphicsItem.ItemPositionChange:
            snapped = QPointF(
                round(value.x() / GRID_SIZE) * GRID_SIZE,
                round(value.y() / GRID_SIZE) * GRID_SIZE,
            )
            return self._resolve_collision(snapped)
        if change == QGraphicsItem.ItemPositionHasChanged:
            self._notify_edges()
        if change == QGraphicsItem.ItemSelectedHasChanged:
            self._selected = bool(value)
            self._update_ports_visual_state()
            self.update()
        return super().itemChange(change, value)

    def _notify_edges(self):
        scene = self.scene()
        if scene is None:
            return
        for item in scene.items():
            if hasattr(item, "update_path"):
                item.update_path()

    def hoverEnterEvent(self, event):
        self._hovered = True
        self._update_ports_visual_state()
        self.update()
        super().hoverEnterEvent(event)

    def hoverLeaveEvent(self, event):
        self._hovered = False
        self._update_ports_visual_state()
        self.update()
        super().hoverLeaveEvent(event)

    def mousePressEvent(self, event):
        self._pressed = True
        self._update_ports_visual_state()
        self.setCursor(Qt.ClosedHandCursor)
        super().mousePressEvent(event)

    def mouseReleaseEvent(self, event):
        self._pressed = False
        self._update_ports_visual_state()
        self.setCursor(Qt.OpenHandCursor)
        super().mouseReleaseEvent(event)
