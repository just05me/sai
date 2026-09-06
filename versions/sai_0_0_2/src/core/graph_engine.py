"""GraphEngine — central graph manager for all three trees."""

from PySide6.QtCore import QObject, Signal
from typing import Optional

from src.core.models import (
    Node, Edge, SaiProject, TreeData, ViewState,
    ProjectMeta, NodePosition, NodeMetadata, NodeStyle,
    EdgeStyle, ControlPoint, now_iso,
)
from src.utils.constants import generate_id, generate_edge_id
from src.utils.logger import Logger


class GraphEngine(QObject):
    """Manages nodes and edges across all trees. Emits signals on changes."""

    node_added = Signal(str, str)
    node_removed = Signal(str, str)
    node_moved = Signal(str, float, float)
    node_updated = Signal(str)
    edge_added = Signal(str)
    edge_removed = Signal(str)
    tree_switched = Signal(str)
    project_changed = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.log = Logger.get()
        self._project = SaiProject()
        self._active_tree = "functional"

    def new_project(self, name: str):
        self._project = SaiProject(
            project=ProjectMeta(
                name=name,
                created_at=now_iso(),
                updated_at=now_iso(),
            )
        )
        self._active_tree = "functional"
        self.project_changed.emit()
        self.log.info(f"New project: {name}")

    def from_dict(self, data: dict):
        try:
            self._project = SaiProject(**data)
            self._active_tree = self._project.view.active_tree
            self.project_changed.emit()
            self.log.info(f"Project '{self._project.project.name}' loaded")
        except Exception as e:
            self.log.error(f"Failed to load project data: {e}")

    def to_dict(self) -> dict:
        self._project.project.updated_at = now_iso()
        self._project.view.active_tree = self._active_tree
        return self._project.model_dump()

    @property
    def project(self) -> SaiProject:
        return self._project

    @property
    def active_tree(self) -> str:
        return self._active_tree

    def set_active_tree(self, tree_name: str):
        if tree_name in self._project.trees:
            self._active_tree = tree_name
            self.tree_switched.emit(tree_name)

    @property
    def current_tree(self) -> TreeData:
        return self._project.trees[self._active_tree]

    def get_tree(self, name: str) -> Optional[TreeData]:
        return self._project.trees.get(name)

    def set_view_state(self, **kwargs):
        for key, val in kwargs.items():
            if hasattr(self._project.view, key):
                setattr(self._project.view, key, val)

    def add_node(self, label: str = "Новый узел", node_type: str = "feature",
                 tree: str = "", x: float = 0.0, y: float = 0.0) -> str:
        if not tree:
            tree = self._active_tree
        node_id = generate_id()
        node = Node(
            id=node_id,
            label=label,
            type=node_type,
            tree=tree,
            position=NodePosition(x=x, y=y),
            metadata=NodeMetadata(
                chat_id=f"node_{node_id[:8]}",
                created_at=now_iso(),
                updated_at=now_iso(),
            ),
        )
        self._project.trees[tree].nodes[node_id] = node
        self.node_added.emit(node_id, tree)
        return node_id

    def remove_node(self, node_id: str) -> bool:
        for tname, tree in self._project.trees.items():
            if node_id in tree.nodes:
                del tree.nodes[node_id]
                tree.edges = [
                    e for e in tree.edges
                    if e.source_id != node_id and e.target_id != node_id
                ]
                self.node_removed.emit(node_id, tname)
                return True
        return False

    def get_node(self, node_id: str) -> Optional[Node]:
        for tree in self._project.trees.values():
            if node_id in tree.nodes:
                return tree.nodes[node_id]
        return None

    def update_node(self, node_id: str, **kwargs) -> bool:
        node = self.get_node(node_id)
        if node is None:
            return False
        for key, val in kwargs.items():
            if hasattr(node, key):
                setattr(node, key, val)
        node.metadata.updated_at = now_iso()
        self.node_updated.emit(node_id)
        return True

    def update_node_position(self, node_id: str, x: float, y: float):
        node = self.get_node(node_id)
        if node:
            node.position.x = x
            node.position.y = y
            self.node_moved.emit(node_id, x, y)

    def get_nodes_by_tree(self, tree_name: str) -> list[Node]:
        tree = self._project.trees.get(tree_name)
        return list(tree.nodes.values()) if tree else []

    def add_edge(self, source_id: str, target_id: str,
                 edge_type: str = "dependency", label: str = "",
                 tree: str = "") -> str:
        if not tree:
            tree = self._active_tree
        if source_id == target_id:
            return ""
        src = self.get_node(source_id)
        tgt = self.get_node(target_id)
        if not src or not tgt:
            return ""
        edge_id = generate_edge_id()
        edge = Edge(
            id=edge_id,
            source_id=source_id,
            target_id=target_id,
            edge_type=edge_type,
            label=label or "",
            tree=tree,
        )
        self._project.trees[tree].edges.append(edge)
        self.edge_added.emit(edge_id)
        return edge_id

    def remove_edge(self, edge_id: str) -> bool:
        for tree in self._project.trees.values():
            for i, e in enumerate(tree.edges):
                if e.id == edge_id:
                    tree.edges.pop(i)
                    self.edge_removed.emit(edge_id)
                    return True
        return False

    def get_edge(self, edge_id: str) -> Optional[Edge]:
        for tree in self._project.trees.values():
            for edge in tree.edges:
                if edge.id == edge_id:
                    return edge
        return None

    def update_edge_path(self, edge_id: str, control_points: list[dict]) -> bool:
        edge = self.get_edge(edge_id)
        if edge is None:
            return False
        edge.control_points = [ControlPoint(**p) for p in control_points]
        return True

    def get_edges_for_tree(self, tree_name: str) -> list[Edge]:
        tree = self._project.trees.get(tree_name)
        return list(tree.edges) if tree else []

    def get_connected_nodes(self, node_id: str) -> list[Node]:
        result = []
        seen = set()
        for tree in self._project.trees.values():
            for edge in tree.edges:
                if edge.source_id == node_id and edge.target_id not in seen:
                    n = tree.nodes.get(edge.target_id)
                    if n:
                        result.append(n)
                        seen.add(edge.target_id)
                elif edge.target_id == node_id and edge.source_id not in seen:
                    n = tree.nodes.get(edge.source_id)
                    if n:
                        result.append(n)
                        seen.add(edge.source_id)
        return result

    def apply_brainstorm_json(self, data: dict, tree: str = "functional") -> int:
        """Create nodes and edges from LLM JSON response. Returns count of nodes added."""
        nodes_data = data.get("nodes", [])
        edges_data = data.get("edges", [])
        id_map = {}

        for i, nd in enumerate(nodes_data):
            x = 100 + (i % 4) * 260
            y = 100 + (i // 4) * 140
            node_id = self.add_node(
                label=nd.get("label", "Узел"),
                node_type=nd.get("type", "feature"),
                tree=tree,
                x=x, y=y,
            )
            self.update_node(
                node_id,
                description=nd.get("description", ""),
            )
            node = self.get_node(node_id)
            if node:
                node.metadata.generated_by = "ai"
            old_id = nd.get("id")
            if old_id:
                id_map[old_id] = node_id

        for ed in edges_data:
            src = id_map.get(ed.get("source_id"), ed.get("source_id"))
            tgt = id_map.get(ed.get("target_id"), ed.get("target_id"))
            if src and tgt:
                self.add_edge(src, tgt, edge_type=ed.get("edge_type", "dependency"),
                              label=ed.get("label", ""), tree=tree)

        return len(nodes_data)
