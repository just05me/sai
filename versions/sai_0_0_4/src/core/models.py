"""Pydantic models for Sai project data (schema v0.0.6)."""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


# ─── Base ──────────────────────────────────────────────────────────

class NodeStyle(BaseModel):
    width: int = 200
    height: int = 80
    color: str = "#743354"
    bg_color: str = "#313244"
    show_description: bool = True
    show_tags: bool = True
    show_ai_status: bool = True


class NodeMetadata(BaseModel):
    chat_id: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    generated_by: str = "user"
    ai_context_summary: str = ""


class NodeHistoryEntry(BaseModel):
    actor: str = "user"   # "user" | "ai"
    action: str = ""
    timestamp: str = ""


class NodePosition(BaseModel):
    x: float = 0.0
    y: float = 0.0


class Node(BaseModel):
    id: str = ""
    type: str = "feature"
    label: str = "Новый узел"
    description: str = ""
    status: str = "draft"
    tree: str = "functional"
    position: NodePosition = NodePosition()
    metadata: NodeMetadata = NodeMetadata()
    style: NodeStyle = NodeStyle()
    history: list[NodeHistoryEntry] = Field(default_factory=list)


class ControlPoint(BaseModel):
    x: float = 0.0
    y: float = 0.0


class EdgeStyle(BaseModel):
    color: str = "#743354"
    width: int = 2
    line_style: str = "orthogonal"


class Edge(BaseModel):
    id: str = ""
    source_id: str = ""
    target_id: str = ""
    label: str = ""
    description: str = ""
    edge_type: str = "dependency"
    tree: str = "functional"
    style: EdgeStyle = EdgeStyle()
    control_points: list[ControlPoint] = Field(default_factory=list)
    source_side: str = ""
    target_side: str = ""


# ─── Cross-tree edges (v0.0.5) ────────────────────────────────────

class CrossTreeEdge(BaseModel):
    """A bridge between nodes in different trees."""
    id: str = ""
    source_tree: str = "functional"
    source_node_id: str = ""
    target_tree: str = "development"
    target_node_id: str = ""
    label: str = ""
    description: str = ""
    edge_type: str = "dependency"
    kind: str = "bridge"


TREE_NAMES_LIST = ["functional", "development", "business"]

TREE_NAMES_MAP = {
    "functional": "Дерево функционала",
    "development": "Дерево разработки",
    "business": "Дерево бизнес-логики",
}


# ─── Tree data ─────────────────────────────────────────────────────

class TreeData(BaseModel):
    label: str = ""
    description: str = ""
    nodes: dict[str, Node] = Field(default_factory=dict)
    edges: list[Edge] = Field(default_factory=list)


# ─── Project settings (v0.0.5) ─────────────────────────────────────

class ProjectSettings(BaseModel):
    autosave_enabled: bool = True
    autosave_interval_sec: int = 60
    chat_keep_forever: bool = True
    default_chat_mode: str = "qa"
    ui_mode: str = "editor"
    default_export_format: str = "markdown"


# ─── View ──────────────────────────────────────────────────────────

class ViewState(BaseModel):
    offset_x: float = 0.0
    offset_y: float = 0.0
    scale: float = 1.0
    active_tree: str = "functional"
    theme: str = "dark"
    focus_mode: bool = False
    minimap_visible: bool = True


# ─── Project meta ──────────────────────────────────────────────────

class ProjectMeta(BaseModel):
    name: str = "Untitled"
    description: str = ""
    created_at: str = ""
    updated_at: str = ""


# ─── Root project ──────────────────────────────────────────────────

class SaiProject(BaseModel):
    sai_version: str = "0.0.6"
    schema_version: str = "0.0.6"
    project: ProjectMeta = ProjectMeta()
    trees: dict[str, TreeData] = Field(default_factory=lambda: {
        "functional": TreeData(label="Дерево функционала", description="Что продукт делает"),
        "development": TreeData(label="Дерево разработки", description="Как продукт создается"),
        "business": TreeData(label="Дерево бизнес-логики", description="User Journey"),
    })
    cross_tree_edges: list[CrossTreeEdge] = Field(default_factory=list)
    settings: ProjectSettings = ProjectSettings()
    usage_stats: dict = Field(default_factory=lambda: {
        "total_requests": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "estimated_cost": 0.0,
        "history": [],
    })
    view: ViewState = ViewState()


# ─── Chat session metadata ─────────────────────────────────────────

class ChatSessionInfo(BaseModel):
    id: str = ""
    scope: str = "global"                     # "global" | "node"
    node_id: Optional[str] = None
    provider: str = ""
    model: str = ""
    created_at: str = ""
    expires_at: str = ""
    token_count: int = 0


# ─── Template ──────────────────────────────────────────────────────

class ProjectTemplate(BaseModel):
    id: str = ""
    name: str = "Новый шаблон"
    description: str = ""
    created_at: str = ""
    trees: dict[str, TreeData] = Field(default_factory=lambda: {
        "functional": TreeData(label="Дерево функционала", description=""),
        "development": TreeData(label="Дерево разработки", description=""),
        "business": TreeData(label="Дерево бизнес-логики", description=""),
    })


# ─── Metrics ───────────────────────────────────────────────────────

class ProjectMetrics(BaseModel):
    total_nodes: int = 0
    nodes_by_tree: dict[str, int] = Field(default_factory=dict)
    nodes_by_status: dict[str, int] = Field(default_factory=dict)
    nodes_by_type: dict[str, int] = Field(default_factory=dict)


# ─── Helpers ───────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
