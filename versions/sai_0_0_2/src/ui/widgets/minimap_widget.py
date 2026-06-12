"""MinimapWidget — horizontal RTL minimap of the canvas."""

from PySide6.QtWidgets import QWidget
from PySide6.QtGui import QPainter, QPen, QBrush, QColor
from PySide6.QtCore import Qt, QRectF

from src.utils.constants import MANTLE, SANTI, SURFACE0, BASE


class MinimapWidget(QWidget):
    """Compact horizontal overview of nodes (RTL layout)."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(48)
        self.setMinimumWidth(200)
        self._nodes: list = []
        self._edges: list = []
        self._collapsed = False
        self._is_dark = True

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        self.update()

    def update_graph(self, nodes: list, edges: list):
        self._nodes = nodes
        self._edges = edges
        self.update()

    def set_collapsed(self, collapsed: bool):
        self._collapsed = collapsed
        self.setVisible(not collapsed)
        self.update()

    def paintEvent(self, event):
        if self._collapsed:
            return

        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        bg = MANTLE if self._is_dark else "#ffffff"
        painter.fillRect(self.rect(), QColor(bg))

        if not self._nodes:
            painter.setPen(QColor(SURFACE0))
            painter.drawText(self.rect(), Qt.AlignCenter, "Мини-карта")
            return

        # Compute bounds
        xs = [n.position.x for n in self._nodes]
        ys = [n.position.y for n in self._nodes]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        span_x = max(max_x - min_x, 200)
        span_y = max(max_y - min_y, 100)

        margin = 8
        w = self.width() - 2 * margin
        h = self.height() - 2 * margin

        def to_screen(nx, ny):
            # RTL: flip x so right = start, left = end
            norm_x = 1.0 - (nx - min_x) / span_x
            sx = margin + norm_x * w
            sy = margin + (ny - min_y) / span_y * h
            return sx, sy

        # Draw edges
        node_map = {n.id: n for n in self._nodes}
        painter.setPen(QPen(QColor(SANTI), 1))
        for edge in self._edges:
            src = node_map.get(edge.source_id)
            tgt = node_map.get(edge.target_id)
            if src and tgt:
                x1, y1 = to_screen(src.position.x, src.position.y)
                x2, y2 = to_screen(tgt.position.x, tgt.position.y)
                painter.drawLine(int(x1), int(y1), int(x2), int(y2))

        # Draw nodes
        painter.setBrush(QBrush(QColor(SANTI)))
        painter.setPen(Qt.NoPen)
        for node in self._nodes:
            sx, sy = to_screen(node.position.x, node.position.y)
            painter.drawEllipse(int(sx - 3), int(sy - 3), 6, 6)

        painter.setPen(QPen(QColor(SURFACE0), 1))
        painter.setBrush(Qt.NoBrush)
        painter.drawRoundedRect(self.rect().adjusted(1, 1, -1, -1), 6, 6)
