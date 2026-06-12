"""GraphEngine — central graph manager for all three trees."""

from PySide6.QtCore import QObject, Signal
from typing import Optional

from src.core.models import (
    Node, Edge, SaiProject, TreeData, ViewState,
    ProjectMeta, NodePosition, NodeMetadata, NodeStyle,
    EdgeStyle, now_iso,
)
from src.utils.constants import generate_id, generate_edge_id
from src.utils.logger import Logger


class GraphEngine(QObject):
    """Manages nodes and edges across all trees. Emits signals on changes."""

    node_added = Signal(str, str)         # node_id, tree_name
    node_removed = Signal(str, str)        # node_id, tree_name
    node_moved = Signal(str, float, float) # node_id, x, y
    node_updated = Signal(str)             # node_id
    edge_added = Signal(str)               # edge_id
    edge_removed = Signal(str)             # edge_id
    tree_switched = Signal(str)            # tree_name
    project_changed = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.log = Logger.get()
        self._project = SaiProject()
        self._active_tree = "functional"

    # --- Project ---

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
        """Load project from a dict (deserialized JSON)."""
        try:
            self._project = SaiProject(**data)
            self._active_tree = self._project.view.active_tree
            self.project_changed.emit()
            self.log.info(f"Project '{self._project.project.name}' loaded")
        except Exception as e:
            self.log.error(f"Failed to load project data: {e}")

    def to_dict(self) -> dict:
        """Serialize project to a dict (for JSON)."""
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
            self.log.debug(f"Switched to tree: {tree_name}")

    @property
    def current_tree(self) -> TreeData:
        return self._project.trees[self._active_tree]

    def get_tree(self, name: str) -> Optional[TreeData]:
        return self._project.trees.get(name)

    # --- Node CRUD ---

    def add_node(self, label: str = "Новый узел", node_type: str = "feature",
                 tree: str = "", x: float = 0.0, y: float = 0.0) -> str:
        """Add a node to the active (or specified) tree."""
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
        self.log.debug(f"Node added: {node_id} ({label}) in {tree}")
        return node_id

    def remove_node(self, node_id: str) -> bool:
        """Remove a node and all its edges."""
        for tname, tree in self._project.trees.items():
            if node_id in tree.nodes:
                del tree.nodes[node_id]
                # Remove connected edges
                tree.edges = [
                    e for e in tree.edges
                    if e.source_id != node_id and e.target_id != node_id
                ]
                self.node_removed.emit(node_id, tname)
                self.log.debug(f"Node removed: {node_id} from {tname}")
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
        if tree:
            return list(tree.nodes.values())
        return []

    # --- Edge CRUD ---

    def add_edge(self, source_id: str, target_id: str,
                 edge_type: str = "dependency", label: str = "",
                 tree: str = "") -> str:
        """Create an edge between two nodes."""
        if not tree:
            tree = self._active_tree
        if source_id == target_id:
            return ""
        # Check both nodes exist
        src = self.get_node(source_id)
        tgt = self.get_node(target_id)
        if not src or not tgt:
            self.log.warning(f"Cannot create edge: node(s) not found")
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
        self.log.debug(f"Edge added: {edge_id} ({source_id} → {target_id})")
        return edge_id

    def remove_edge(self, edge_id: str) -> bool:
        for tree in self._project.trees.values():
            for i, e in enumerate(tree.edges):
                if e.id == edge_id:
                    tree.edges.pop(i)
                    self.edge_removed.emit(edge_id)
                    return True
        return False

    def get_edges_for_tree(self, tree_name: str) -> list[Edge]:
        tree = self._project.trees.get(tree_name)
        return list(tree.edges) if tree else []

    def get_connected_nodes(self, node_id: str) -> list[Node]:
        """Get nodes directly connected to this node (1 level)."""
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
