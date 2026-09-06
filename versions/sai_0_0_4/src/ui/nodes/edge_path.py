"""EdgePath — orthogonal routing with node/edge hitbox avoidance."""

import heapq
import itertools
import math
from typing import Callable

from PySide6.QtWidgets import QGraphicsPathItem, QGraphicsEllipseItem
from PySide6.QtGui import (
    QPainter, QPen, QColor, QPainterPath, QPolygonF, QBrush, QPainterPathStroker,
)
from PySide6.QtCore import QPointF, Qt, QRectF

from src.utils.constants import SANTI, EDGE_HITBOX, SUBTEXT0, PORT_RADIUS


PORT_SIDES = ("top", "right", "bottom", "left")
EDGE_GAP = PORT_RADIUS * 2 + 4
ARROW_LEN = 8
ROUTE_STEP = 12
BOX_ROUTE_MARGIN = 16
EDGE_ROUTE_MARGIN = EDGE_HITBOX + 8
HANDLE_RADIUS = 4


def _pick_sides(src_box: QRectF, tgt_box: QRectF) -> tuple[str, str]:
    src_cx, src_cy = src_box.center().x(), src_box.center().y()
    tgt_cx, tgt_cy = tgt_box.center().x(), tgt_box.center().y()
    dx = tgt_cx - src_cx
    dy = tgt_cy - src_cy
    if abs(dx) >= abs(dy):
        return ("right", "left") if dx >= 0 else ("left", "right")
    return ("bottom", "top") if dy >= 0 else ("top", "bottom")


def _side_vector(side: str) -> QPointF:
    return {
        "right": QPointF(1, 0),
        "left": QPointF(-1, 0),
        "top": QPointF(0, -1),
        "bottom": QPointF(0, 1),
    }[side]


def _inflate_rect(rect: QRectF, pad: float) -> QRectF:
    return rect.adjusted(-pad, -pad, pad, pad)


def _segment_to_rect(a: QPointF, b: QPointF, margin: float) -> QRectF:
    left = min(a.x(), b.x()) - margin
    right = max(a.x(), b.x()) + margin
    top = min(a.y(), b.y()) - margin
    bottom = max(a.y(), b.y()) + margin
    return QRectF(left, top, right - left, bottom - top)


def _segment_hits_rect(a: QPointF, b: QPointF, rect: QRectF) -> bool:
    """Strict axis-aligned segment vs rect test (touch counts as hit)."""
    x1, y1 = a.x(), a.y()
    x2, y2 = b.x(), b.y()
    if abs(x1 - x2) < 1e-6:  # vertical
        x = x1
        if x < rect.left() or x > rect.right():
            return False
        y_min, y_max = min(y1, y2), max(y1, y2)
        return not (y_max < rect.top() or y_min > rect.bottom())
    if abs(y1 - y2) < 1e-6:  # horizontal
        y = y1
        if y < rect.top() or y > rect.bottom():
            return False
        x_min, x_max = min(x1, x2), max(x1, x2)
        return not (x_max < rect.left() or x_min > rect.right())
    # We route orthogonally, but keep safe fallback:
    return _segment_to_rect(a, b, 0).intersects(rect)


def _polyline_hits_rects(points: list[QPointF], rects: list[QRectF]) -> bool:
    for a, b in zip(points, points[1:]):
        for rect in rects:
            if _segment_hits_rect(a, b, rect):
                return True
    return False


def _polyline_hits_terminal_guards(points: list[QPointF], src_guard: QRectF, tgt_guard: QRectF) -> bool:
    """Allow touching source/target guards only on the first/last segment."""
    if len(points) < 2:
        return False
    last_idx = len(points) - 2
    for idx, (a, b) in enumerate(zip(points, points[1:])):
        if idx != 0 and _segment_hits_rect(a, b, src_guard):
            return True
        if idx != last_idx and _segment_hits_rect(a, b, tgt_guard):
            return True
    return False


def _poly_points_from_path(path: QPainterPath) -> list[QPointF]:
    pts: list[QPointF] = []
    for i in range(path.elementCount()):
        e = path.elementAt(i)
        pts.append(QPointF(e.x, e.y))
    return pts


def _compress_collinear(points: list[QPointF]) -> list[QPointF]:
    if len(points) <= 2:
        return points
    out = [points[0]]
    for i in range(1, len(points) - 1):
        a = out[-1]
        b = points[i]
        c = points[i + 1]
        abx = b.x() - a.x()
        aby = b.y() - a.y()
        bcx = c.x() - b.x()
        bcy = c.y() - b.y()
        if abs(abx * bcy - aby * bcx) < 1e-6:
            continue
        out.append(b)
    out.append(points[-1])
    return out


def _manhattan(a: tuple[int, int], b: tuple[int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def _a_star(
    start: QPointF,
    goal: QPointF,
    blocked_rects: list[QRectF],
    step: int = ROUTE_STEP,
) -> list[QPointF] | None:
    if step <= 0:
        return None

    def to_grid(p: QPointF) -> tuple[int, int]:
        return (int(round(p.x() / step)), int(round(p.y() / step)))

    def to_point(g: tuple[int, int]) -> QPointF:
        return QPointF(g[0] * step, g[1] * step)

    def blocked(g: tuple[int, int]) -> bool:
        p = to_point(g)
        return any(rect.contains(p) for rect in blocked_rects)

    def transition_blocked(g1: tuple[int, int], g2: tuple[int, int]) -> bool:
        p1 = to_point(g1)
        p2 = to_point(g2)
        return any(_segment_hits_rect(p1, p2, rect) for rect in blocked_rects)

    s = to_grid(start)
    t = to_grid(goal)

    # Small radial search to move start/goal off blocked cells if needed.
    def nearest_free(seed: tuple[int, int]) -> tuple[int, int] | None:
        if not blocked(seed):
            return seed
        for r in range(1, 8):
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if abs(dx) + abs(dy) != r:
                        continue
                    cand = (seed[0] + dx, seed[1] + dy)
                    if not blocked(cand):
                        return cand
        return None

    s = nearest_free(s)
    t = nearest_free(t)
    if s is None or t is None:
        return None

    # Search bounds: include obstacles so route can go around them.
    min_x = min(s[0], t[0]) - 80
    max_x = max(s[0], t[0]) + 80
    min_y = min(s[1], t[1]) - 80
    max_y = max(s[1], t[1]) + 80
    for rect in blocked_rects:
        min_x = min(min_x, int(math.floor(rect.left() / step)) - 20)
        max_x = max(max_x, int(math.ceil(rect.right() / step)) + 20)
        min_y = min(min_y, int(math.floor(rect.top() / step)) - 20)
        max_y = max(max_y, int(math.ceil(rect.bottom() / step)) + 20)

    open_heap: list[tuple[float, int, tuple[int, int]]] = []
    counter = itertools.count()
    g_score: dict[tuple[int, int], float] = {s: 0.0}
    parent: dict[tuple[int, int], tuple[int, int]] = {}

    heapq.heappush(open_heap, (float(_manhattan(s, t)), next(counter), s))
    closed: set[tuple[int, int]] = set()
    neighbors = ((1, 0), (-1, 0), (0, 1), (0, -1))

    while open_heap:
        _, _, cur = heapq.heappop(open_heap)
        if cur in closed:
            continue
        if cur == t:
            rev = [cur]
            while rev[-1] in parent:
                rev.append(parent[rev[-1]])
            rev.reverse()
            return [to_point(g) for g in rev]
        closed.add(cur)

        for dx, dy in neighbors:
            nxt = (cur[0] + dx, cur[1] + dy)
            if nxt in closed:
                continue
            if nxt[0] < min_x or nxt[0] > max_x or nxt[1] < min_y or nxt[1] > max_y:
                continue
            if blocked(nxt):
                continue
            if transition_blocked(cur, nxt):
                continue

            step_cost = 1.0
            # Mild turn penalty to reduce jagged routes.
            prev = parent.get(cur)
            if prev is not None:
                v1 = (cur[0] - prev[0], cur[1] - prev[1])
                v2 = (nxt[0] - cur[0], nxt[1] - cur[1])
                if v1 != v2:
                    step_cost += 0.2

            tentative = g_score[cur] + step_cost
            if tentative < g_score.get(nxt, float("inf")):
                parent[nxt] = cur
                g_score[nxt] = tentative
                f = tentative + _manhattan(nxt, t)
                heapq.heappush(open_heap, (f, next(counter), nxt))
    return None


def _route_orthogonal_fallback(
    p_src: QPointF,
    src_side: str,
    src_box: QRectF,
    p_tgt: QPointF,
    tgt_side: str,
    tgt_box: QRectF,
) -> list[QPointF]:
    o_s = _side_vector(src_side)
    o_t = _side_vector(tgt_side)
    stub_s = QPointF(p_src.x() + o_s.x() * EDGE_GAP, p_src.y() + o_s.y() * EDGE_GAP)
    stub_t = QPointF(p_tgt.x() + o_t.x() * EDGE_GAP, p_tgt.y() + o_t.y() * EDGE_GAP)

    horiz_s = src_side in ("left", "right")
    horiz_t = tgt_side in ("left", "right")
    pts = [p_src, stub_s]

    if horiz_s and horiz_t:
        if (src_side == "right" and stub_s.x() < stub_t.x()) or (
            src_side == "left" and stub_s.x() > stub_t.x()
        ):
            mid_x = (stub_s.x() + stub_t.x()) / 2.0
            pts += [QPointF(mid_x, stub_s.y()), QPointF(mid_x, stub_t.y())]
        else:
            top_y = min(src_box.top(), tgt_box.top()) - EDGE_GAP
            bot_y = max(src_box.bottom(), tgt_box.bottom()) + EDGE_GAP
            via_y = (
                top_y
                if abs(stub_s.y() - top_y) + abs(stub_t.y() - top_y)
                <= abs(stub_s.y() - bot_y) + abs(stub_t.y() - bot_y)
                else bot_y
            )
            pts += [QPointF(stub_s.x(), via_y), QPointF(stub_t.x(), via_y)]
    elif (not horiz_s) and (not horiz_t):
        if (src_side == "bottom" and stub_s.y() < stub_t.y()) or (
            src_side == "top" and stub_s.y() > stub_t.y()
        ):
            mid_y = (stub_s.y() + stub_t.y()) / 2.0
            pts += [QPointF(stub_s.x(), mid_y), QPointF(stub_t.x(), mid_y)]
        else:
            left_x = min(src_box.left(), tgt_box.left()) - EDGE_GAP
            right_x = max(src_box.right(), tgt_box.right()) + EDGE_GAP
            via_x = (
                left_x
                if abs(stub_s.x() - left_x) + abs(stub_t.x() - left_x)
                <= abs(stub_s.x() - right_x) + abs(stub_t.x() - right_x)
                else right_x
            )
            pts += [QPointF(via_x, stub_s.y()), QPointF(via_x, stub_t.y())]
    else:
        corner = QPointF(stub_t.x(), stub_s.y()) if (horiz_s and not horiz_t) else QPointF(stub_s.x(), stub_t.y())
        pts.append(corner)

    pts += [stub_t, p_tgt]
    return pts


def _shrink_endpoint(pts: list[QPointF], shrink: float) -> list[QPointF]:
    if shrink <= 0 or len(pts) < 2:
        return pts
    p_end = pts[-1]
    p_prev = pts[-2]
    dx = p_end.x() - p_prev.x()
    dy = p_end.y() - p_prev.y()
    length = math.hypot(dx, dy)
    if length <= shrink:
        return pts
    nx, ny = dx / length, dy / length
    return pts[:-1] + [QPointF(p_end.x() - nx * shrink, p_end.y() - ny * shrink)]


class EdgePath(QGraphicsPathItem):
    """Orthogonal edge with locked endpoints and obstacle-aware routing."""

    def __init__(
        self,
        edge_id: str,
        source_node,
        target_node,
        color: str = SANTI,
        label: str = "",
        control_points: list = None,
        source_side: str = "",
        target_side: str = "",
        on_path_changed: Callable[[str, list[dict]], None] | None = None,
    ):
        super().__init__()
        self._edge_id = edge_id
        self._source = source_node
        self._target = target_node
        self._label = label
        self._color = QColor(color)
        self._control_points: list[QPointF] = []
        for cp in (control_points or []):
            if isinstance(cp, QPointF):
                self._control_points.append(QPointF(cp.x(), cp.y()))
            elif isinstance(cp, dict):
                self._control_points.append(QPointF(float(cp.get("x", 0.0)), float(cp.get("y", 0.0))))
        self._last_safe_points: list[QPointF] = []
        self._hovered = False
        self._control_handles: list[QGraphicsEllipseItem] = []
        self._arrow_dir: QPointF = QPointF(1, 0)
        self._ignore_handle_move_events = False
        self._render_points: list[QPointF] = []
        self._on_path_changed = on_path_changed
        self._source_side = source_side if source_side in PORT_SIDES else ""
        self._target_side = target_side if target_side in PORT_SIDES else ""

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
        normalized: list[QPointF] = []
        for cp in (points or []):
            if isinstance(cp, QPointF):
                normalized.append(QPointF(cp.x(), cp.y()))
            elif isinstance(cp, dict):
                normalized.append(QPointF(float(cp.get("x", 0.0)), float(cp.get("y", 0.0))))
        self._control_points = normalized
        self.update_path()

    def get_control_points(self) -> list[dict]:
        return [{"x": p.x(), "y": p.y()} for p in (self._control_points or [])]

    def _endpoints_alive(self) -> bool:
        for node in (self._source, self._target):
            if node is None:
                return False
            try:
                if node.scene() is None:
                    return False
            except RuntimeError:
                return False
        return True

    def _self_remove(self):
        for h in list(self._control_handles):
            try:
                if h.scene():
                    h.scene().removeItem(h)
            except RuntimeError:
                pass
        self._control_handles.clear()
        sc = self.scene()
        if sc is not None:
            try:
                sc.removeItem(self)
            except RuntimeError:
                pass

    def _resolve_locked_sides(self, src_box: QRectF, tgt_box: QRectF) -> tuple[str, str]:
        if self._source_side in PORT_SIDES and self._target_side in PORT_SIDES:
            return self._source_side, self._target_side
        s_side, t_side = _pick_sides(src_box, tgt_box)
        if self._source_side not in PORT_SIDES:
            self._source_side = s_side
        if self._target_side not in PORT_SIDES:
            self._target_side = t_side
        return self._source_side, self._target_side

    def _collect_box_obstacles(self, src_node, tgt_node) -> list[QRectF]:
        scene = self.scene()
        if scene is None:
            return []
        blocks: list[QRectF] = []
        for item in scene.items():
            if item in (src_node, tgt_node):
                continue
            if not hasattr(item, "box_scene_rect") or not hasattr(item, "node_id"):
                continue
            if not item.isVisible():
                continue
            blocks.append(_inflate_rect(item.box_scene_rect(), BOX_ROUTE_MARGIN))
        return blocks

    def _collect_edge_obstacles(self) -> list[QRectF]:
        scene = self.scene()
        if scene is None:
            return []
        blocks: list[QRectF] = []
        my_src = getattr(self._source, "node_id", "")
        my_tgt = getattr(self._target, "node_id", "")
        for item in scene.items():
            if item is self:
                continue
            if not hasattr(item, "edge_id") or not hasattr(item, "path"):
                continue
            if not item.isVisible():
                continue

            other_src = getattr(getattr(item, "source_node", None), "node_id", "")
            other_tgt = getattr(getattr(item, "target_node", None), "node_id", "")
            # Near endpoints we allow channels for edges that share source/target.
            if my_src in (other_src, other_tgt) or my_tgt in (other_src, other_tgt):
                continue

            pts = _poly_points_from_path(item.path())
            for a, b in zip(pts, pts[1:]):
                blocks.append(_segment_to_rect(a, b, EDGE_ROUTE_MARGIN))
        return blocks

    def _current_endpoints(self) -> tuple[QPointF, QPointF, str, str, QRectF, QRectF]:
        src_box = self._source.box_scene_rect() if hasattr(self._source, "box_scene_rect") else self._source.sceneBoundingRect()
        tgt_box = self._target.box_scene_rect() if hasattr(self._target, "box_scene_rect") else self._target.sceneBoundingRect()
        src_side, tgt_side = self._resolve_locked_sides(src_box, tgt_box)
        try:
            p1 = self._source.get_port(src_side).scene_center()
            p2 = self._target.get_port(tgt_side).scene_center()
        except (AttributeError, KeyError):
            p1 = self._source.get_output_port().scene_center()
            p2 = self._target.get_input_port().scene_center()
        return p1, p2, src_side, tgt_side, src_box, tgt_box

    def _set_rendered_polyline(self, pts: list[QPointF], rebuild_handles: bool = True):
        pts = _shrink_endpoint(pts, PORT_RADIUS)
        self._render_points = list(pts)
        self._last_safe_points = list(pts)
        if len(pts) >= 2:
            dxv = pts[-1].x() - pts[-2].x()
            dyv = pts[-1].y() - pts[-2].y()
            self._arrow_dir = QPointF(dxv, dyv)

        path = QPainterPath()
        path.moveTo(pts[0])
        for pt in pts[1:]:
            path.lineTo(pt)
        self.setPath(path)
        if rebuild_handles:
            self._rebuild_handles(pts)

    def _emit_path_changed(self):
        if self._on_path_changed:
            self._on_path_changed(self._edge_id, self.get_control_points())

    def _on_segment_drag(self, segment_index: int, pos: QPointF, final: bool = False):
        if self._ignore_handle_move_events:
            return
        if segment_index <= 0:
            return
        points = list(self._render_points or _poly_points_from_path(self.path()))
        if len(points) < 4:
            return
        if segment_index >= len(points) - 2:
            return

        old_points = list(points)
        a = points[segment_index]
        b = points[segment_index + 1]
        if abs(a.y() - b.y()) <= 1e-6:  # horizontal segment => move by Y
            new_y = pos.y()
            points[segment_index] = QPointF(a.x(), new_y)
            points[segment_index + 1] = QPointF(b.x(), new_y)
        elif abs(a.x() - b.x()) <= 1e-6:  # vertical segment => move by X
            new_x = pos.x()
            points[segment_index] = QPointF(new_x, a.y())
            points[segment_index + 1] = QPointF(new_x, b.y())
        else:
            return

        try:
            p1, p2, _src_side, _tgt_side, src_box, tgt_box = self._current_endpoints()
        except RuntimeError:
            return
        points[0] = p1
        points[-1] = points[-1]  # already shrunk visual endpoint; keep visual continuity during drag

        points = _compress_collinear(points)

        box_blocked = self._collect_box_obstacles(self._source, self._target)
        edge_blocked = self._collect_edge_obstacles()
        blocked = box_blocked + edge_blocked
        src_guard = _inflate_rect(src_box, BOX_ROUTE_MARGIN)
        tgt_guard = _inflate_rect(tgt_box, BOX_ROUTE_MARGIN)
        if _polyline_hits_rects(points, blocked) or _polyline_hits_terminal_guards(points, src_guard, tgt_guard):
            self._render_points = old_points
            if final:
                self._set_rendered_polyline(old_points, rebuild_handles=True)
            return

        self._control_points = [QPointF(p.x(), p.y()) for p in points[1:-1]]
        self._set_rendered_polyline(points, rebuild_handles=final)
        if final:
            self._emit_path_changed()

    def update_path(self):
        if not self._endpoints_alive():
            self._self_remove()
            return

        p1, p2, src_side, tgt_side, src_box, tgt_box = self._current_endpoints()
        box_blocked = self._collect_box_obstacles(self._source, self._target)
        edge_blocked = self._collect_edge_obstacles()
        blocked = box_blocked + edge_blocked
        src_guard = _inflate_rect(src_box, BOX_ROUTE_MARGIN)
        tgt_guard = _inflate_rect(tgt_box, BOX_ROUTE_MARGIN)

        manual_pts: list[QPointF] | None = None
        if self._control_points:
            cand = [p1] + list(self._control_points) + [p2]
            cand = _compress_collinear(cand)
            if (not _polyline_hits_rects(cand, blocked)
                    and not _polyline_hits_terminal_guards(cand, src_guard, tgt_guard)):
                manual_pts = cand
            else:
                # Manual route became unsafe after scene changes.
                self._control_points = []

        if manual_pts is not None:
            self._set_rendered_polyline(manual_pts, rebuild_handles=True)
            return

        o_s = _side_vector(src_side)
        o_t = _side_vector(tgt_side)
        stub_s = QPointF(p1.x() + o_s.x() * EDGE_GAP, p1.y() + o_s.y() * EDGE_GAP)
        stub_t = QPointF(p2.x() + o_t.x() * EDGE_GAP, p2.y() + o_t.y() * EDGE_GAP)

        # Strict route: never cross box hitboxes, also avoid edge channels.
        middle = _a_star(stub_s, stub_t, blocked, ROUTE_STEP)
        if middle and len(middle) >= 2:
            pts = [p1] + middle + [p2]
            pts = _compress_collinear(pts)
            if (_polyline_hits_rects(pts, blocked)
                    or _polyline_hits_terminal_guards(pts, src_guard, tgt_guard)):
                return
            self._set_rendered_polyline(pts, rebuild_handles=True)
            return

        # Last resort: keep previous safe path or build a global detour.
        if self._last_safe_points and not _polyline_hits_rects(self._last_safe_points, blocked):
            pts = list(self._last_safe_points)
        else:
            detour = self._route_global_detour(p1, src_side, p2, tgt_side, box_blocked)
            pts = detour if detour else _route_orthogonal_fallback(
                p1, src_side, src_box, p2, tgt_side, tgt_box
            )

        # Hard safety guard: never accept route crossing any hitboxes.
        if _polyline_hits_rects(pts, blocked) or _polyline_hits_terminal_guards(pts, src_guard, tgt_guard):
            return
        self._set_rendered_polyline(pts, rebuild_handles=True)

    def _route_global_detour(
        self,
        p1: QPointF,
        src_side: str,
        p2: QPointF,
        tgt_side: str,
        box_blocked: list[QRectF],
    ) -> list[QPointF] | None:
        """Build top/bottom macro-detour that bypasses all box hitboxes."""
        o_s = _side_vector(src_side)
        o_t = _side_vector(tgt_side)
        stub_s = QPointF(p1.x() + o_s.x() * EDGE_GAP, p1.y() + o_s.y() * EDGE_GAP)
        stub_t = QPointF(p2.x() + o_t.x() * EDGE_GAP, p2.y() + o_t.y() * EDGE_GAP)

        if box_blocked:
            top_y = min(r.top() for r in box_blocked) - EDGE_GAP * 2
            bot_y = max(r.bottom() for r in box_blocked) + EDGE_GAP * 2
        else:
            top_y = min(stub_s.y(), stub_t.y()) - EDGE_GAP * 2
            bot_y = max(stub_s.y(), stub_t.y()) + EDGE_GAP * 2

        cand_top = [p1, stub_s, QPointF(stub_s.x(), top_y), QPointF(stub_t.x(), top_y), stub_t, p2]
        cand_bot = [p1, stub_s, QPointF(stub_s.x(), bot_y), QPointF(stub_t.x(), bot_y), stub_t, p2]
        candidates = [cand_top, cand_bot]

        safe: list[list[QPointF]] = []
        for cand in candidates:
            if not _polyline_hits_rects(cand, box_blocked):
                safe.append(_compress_collinear(cand))
        if not safe:
            return None
        # Choose shortest Manhattan candidate.
        def cost(poly: list[QPointF]) -> float:
            return sum(abs(b.x() - a.x()) + abs(b.y() - a.y()) for a, b in zip(poly, poly[1:]))
        return min(safe, key=cost)

    def _rebuild_handles(self, full_points: list[QPointF]):
        for h in self._control_handles:
            if h.scene():
                h.scene().removeItem(h)
        self._control_handles.clear()
        scene = self.scene()
        if scene is None:
            return
        if len(full_points) < 4:
            return
        # Segment handles: drag orthogonal channel between bends.
        for i in range(1, len(full_points) - 2):
            a = full_points[i]
            b = full_points[i + 1]
            mid = QPointF((a.x() + b.x()) / 2.0, (a.y() + b.y()) / 2.0)
            horizontal = abs(a.y() - b.y()) <= 1e-6
            handle = _EdgeSegmentHandle(
                self,
                i,
                horizontal,
                mid,
                -HANDLE_RADIUS,
                -HANDLE_RADIUS,
                HANDLE_RADIUS * 2,
                HANDLE_RADIUS * 2,
            )
            handle.setBrush(QBrush(QColor(SANTI)))
            handle.setPen(QPen(QColor("white"), 1))
            handle.setPos(mid)
            handle.setZValue(5)
            handle.setVisible(False)
            handle.setFlag(handle.GraphicsItemFlag.ItemIsMovable, True)
            scene.addItem(handle)
            self._control_handles.append(handle)

    def shape(self):
        """Visual selection hitbox for the edge."""
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

        pts = _poly_points_from_path(self.path())
        if len(pts) >= 2:
            p_end = pts[-1]
            dx = self._arrow_dir.x()
            dy = self._arrow_dir.y()
            length = math.hypot(dx, dy) or 1.0
            nx, ny = dx / length, dy / length
            px, py = -ny, nx
            tip = p_end
            base = QPointF(p_end.x() - nx * ARROW_LEN, p_end.y() - ny * ARROW_LEN)
            wing1 = QPointF(base.x() + px * 4, base.y() + py * 4)
            wing2 = QPointF(base.x() - px * 4, base.y() - py * 4)
            arrow = QPolygonF([tip, wing1, wing2])
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


class _EdgeSegmentHandle(QGraphicsEllipseItem):
    """Draggable orthogonal segment handle for EdgePath."""

    def __init__(
        self,
        edge: EdgePath,
        segment_index: int,
        horizontal_segment: bool,
        anchor: QPointF,
        x: float,
        y: float,
        w: float,
        h: float,
    ):
        super().__init__(x, y, w, h)
        self._edge = edge
        self._segment_index = segment_index
        self._horizontal_segment = horizontal_segment
        self._anchor = QPointF(anchor.x(), anchor.y())
        self.setFlag(QGraphicsEllipseItem.ItemSendsScenePositionChanges, True)
        self.setCursor(Qt.OpenHandCursor)

    def mousePressEvent(self, event):
        self.setCursor(Qt.ClosedHandCursor)
        super().mousePressEvent(event)

    def mouseReleaseEvent(self, event):
        self.setCursor(Qt.OpenHandCursor)
        self._edge._on_segment_drag(self._segment_index, self.pos(), final=True)
        super().mouseReleaseEvent(event)

    def itemChange(self, change, value):
        if change == QGraphicsEllipseItem.ItemPositionChange:
            p = value
            if self._horizontal_segment:
                return QPointF(self._anchor.x(), p.y())
            return QPointF(p.x(), self._anchor.y())
        if change == QGraphicsEllipseItem.ItemPositionHasChanged:
            self._edge._on_segment_drag(self._segment_index, self.pos(), final=False)
        return super().itemChange(change, value)
