"""MinimapWidget — compact canvas overview with box+orthogonal-paths style."""

from PySide6.QtWidgets import QWidget
from PySide6.QtGui import QPainter, QPen, QBrush, QColor, QFont
from PySide6.QtCore import Qt, QRectF, QPointF

from src.utils.constants import (
    SANTI, NODE_COLORS, NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT,
)


def _pick_sides_xy(sx_c, sy_c, sw, sh, tx_c, ty_c, tw, th):
    """Pick best source/target sides between two rectangles (centers + size)."""
    dx = tx_c - sx_c
    dy = ty_c - sy_c
    if abs(dx) >= abs(dy):
        return ("right", "left") if dx >= 0 else ("left", "right")
    return ("bottom", "top") if dy >= 0 else ("top", "bottom")


def _port_xy(cx, cy, w, h, side):
    if side == "right":
        return cx + w / 2, cy
    if side == "left":
        return cx - w / 2, cy
    if side == "top":
        return cx, cy - h / 2
    return cx, cy + h / 2


class MinimapWidget(QWidget):
    """Compact overview of nodes drawn as small boxes + orthogonal connectors."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(140)
        self.setMinimumWidth(220)
        self._nodes: list = []
        self._edges: list = []
        self._collapsed = False
        self._is_dark = True
        self._viewport_rect: QRectF | None = None

    def set_dark_theme(self, is_dark: bool):
        self._is_dark = is_dark
        self.update()

    def update_graph(self, nodes: list, edges: list):
        self._nodes = nodes
        self._edges = edges
        self.update()

    def set_viewport(self, scene_rect: QRectF | None):
        self._viewport_rect = scene_rect
        self.update()

    def set_collapsed(self, collapsed: bool):
        self._collapsed = collapsed
        self.setVisible(not collapsed)

    def paintEvent(self, event):
        if self._collapsed:
            return

        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        bg = "#181825" if self._is_dark else "#ffffff"
        border_color = "#313244" if self._is_dark else "#d0d0da"
        text_color = "#6c7086" if self._is_dark else "#6c6f85"

        painter.fillRect(self.rect(), QColor(bg))
        painter.setPen(QPen(QColor(border_color), 1))
        painter.setBrush(Qt.NoBrush)
        painter.drawRoundedRect(self.rect().adjusted(1, 1, -1, -1), 4, 4)

        if not self._nodes:
            painter.setPen(QColor(text_color))
            painter.drawText(self.rect(), Qt.AlignCenter, "Мини-карта")
            return

        # --- Scene bounds (covering both node centers AND their boxes) ---
        nw = NODE_DEFAULT_WIDTH
        nh = NODE_DEFAULT_HEIGHT
        lefts, rights, tops, bottoms = [], [], [], []
        for n in self._nodes:
            cx, cy = n.position.x + nw / 2, n.position.y + nh / 2
            lefts.append(cx - nw / 2)
            rights.append(cx + nw / 2)
            tops.append(cy - nh / 2)
            bottoms.append(cy + nh / 2)
        min_x, max_x = min(lefts), max(rights)
        min_y, max_y = min(tops), max(bottoms)
        span_x = max(max_x - min_x, 1)
        span_y = max(max_y - min_y, 1)

        margin = 10
        w = self.width() - 2 * margin
        h = self.height() - 2 * margin
        # Preserve aspect ratio
        scale = min(w / span_x, h / span_y)
        # Center within the widget
        offset_x = margin + (w - span_x * scale) / 2
        offset_y = margin + (h - span_y * scale) / 2

        def to_mini(sx, sy):
            # Render minimap as right-to-left: larger scene X appears on the left.
            return offset_x + (max_x - sx) * scale, offset_y + (sy - min_y) * scale

        # --- Edges first (orthogonal) ---
        node_map = {n.id: n for n in self._nodes}
        edge_pen = QPen(QColor("#585b70" if self._is_dark else "#9098a5"), 1.0)
        edge_pen.setCosmetic(True)
        painter.setPen(edge_pen)
        painter.setBrush(Qt.NoBrush)

        for edge in self._edges:
            src = node_map.get(edge.source_id)
            tgt = node_map.get(edge.target_id)
            if not src or not tgt:
                continue
            scx, scy = src.position.x + nw / 2, src.position.y + nh / 2
            tcx, tcy = tgt.position.x + nw / 2, tgt.position.y + nh / 2
            s_side, t_side = _pick_sides_xy(scx, scy, nw, nh, tcx, tcy, nw, nh)
            s_px, s_py = _port_xy(scx, scy, nw, nh, s_side)
            t_px, t_py = _port_xy(tcx, tcy, nw, nh, t_side)

            x1, y1 = to_mini(s_px, s_py)
            x2, y2 = to_mini(t_px, t_py)

            # Build an L/S poly-line between (x1, y1) and (x2, y2)
            mini_path_pts = self._orthogonal_path(
                x1, y1, s_side, x2, y2, t_side,
            )
            for i in range(len(mini_path_pts) - 1):
                a = mini_path_pts[i]
                b = mini_path_pts[i + 1]
                painter.drawLine(QPointF(*a), QPointF(*b))

        # --- Nodes as small boxes with a header strip ---
        body_color = QColor("#262637" if self._is_dark else "#f1f1f5")
        outline = QColor("#45475a" if self._is_dark else "#bcc0cc")
        painter.setFont(QFont("JetBrains Mono", 6))

        for node in self._nodes:
            cx, cy = node.position.x + nw / 2, node.position.y + nh / 2
            x_l, y_t = to_mini(cx - nw / 2, cy - nh / 2)
            x_r, y_b = to_mini(cx + nw / 2, cy + nh / 2)
            left, right = min(x_l, x_r), max(x_l, x_r)
            top, bottom = min(y_t, y_b), max(y_t, y_b)
            bw = max(right - left, 14)
            bh = max(bottom - top, 6)
            rect = QRectF(left, top, bw, bh)

            painter.setBrush(QBrush(body_color))
            painter.setPen(QPen(outline, 1))
            painter.drawRoundedRect(rect, 1.5, 1.5)

            # Header strip (colored by node type) — 1/3 of the box height
            header_color = QColor(NODE_COLORS.get(getattr(node, "type", ""), SANTI))
            header_color.setAlpha(180)
            header_h = max(bh * 0.34, 3)
            header_rect = QRectF(left, top, bw, header_h)
            painter.setBrush(QBrush(header_color))
            painter.setPen(Qt.NoPen)
            painter.drawRoundedRect(header_rect, 1.5, 1.5)

            # Tiny label if there is room
            if bw > 30 and bh > 10:
                painter.setPen(QColor("#cdd6f4" if self._is_dark else "#4c4f69"))
                label = getattr(node, "label", "")
                painter.drawText(
                    QRectF(left + 2, top + header_h, bw - 4, bh - header_h),
                    Qt.AlignLeft | Qt.AlignVCenter,
                    label[:18],
                )

        # --- Viewport rectangle ---
        if self._viewport_rect:
            vx1, vy1 = to_mini(self._viewport_rect.x(), self._viewport_rect.y())
            vx2, vy2 = to_mini(
                self._viewport_rect.x() + self._viewport_rect.width(),
                self._viewport_rect.y() + self._viewport_rect.height(),
            )
            vx_l, vx_r = min(vx1, vx2), max(vx1, vx2)
            vy_t, vy_b = min(vy1, vy2), max(vy1, vy2)
            painter.setPen(QPen(QColor("#cdd6f4"), 1, Qt.DashLine))
            painter.setBrush(QBrush(QColor(205, 214, 244, 28)))
            painter.drawRect(QRectF(vx_l, vy_t, max(vx_r - vx_l, 8), max(vy_b - vy_t, 6)))

    def _orthogonal_path(self, x1, y1, s_side, x2, y2, t_side):
        """Tiny analogue of edge routing for the minimap (S/U style)."""
        horiz_s = s_side in ("left", "right")
        horiz_t = t_side in ("left", "right")
        pts = [(x1, y1)]
        if horiz_s and horiz_t:
            mid_x = (x1 + x2) / 2
            pts += [(mid_x, y1), (mid_x, y2)]
        elif (not horiz_s) and (not horiz_t):
            mid_y = (y1 + y2) / 2
            pts += [(x1, mid_y), (x2, mid_y)]
        else:
            # L-bend
            if horiz_s and not horiz_t:
                pts.append((x2, y1))
            else:
                pts.append((x1, y2))
        pts.append((x2, y2))
        return pts
