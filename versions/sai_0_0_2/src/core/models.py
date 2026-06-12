"""Pydantic models for Sai project data (schema v2)."""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


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


class TreeData(BaseModel):
    label: str = ""
    description: str = ""
    nodes: dict[str, Node] = Field(default_factory=dict)
    edges: list[Edge] = Field(default_factory=list)


class ViewState(BaseModel):
    offset_x: float = 0.0
    offset_y: float = 0.0
    scale: float = 1.0
    active_tree: str = "functional"
    theme: str = "dark"
    focus_mode: bool = False
    minimap_visible: bool = True


class ProjectMeta(BaseModel):
    name: str = "Untitled"
    description: str = ""
    created_at: str = ""
    updated_at: str = ""


class SaiProject(BaseModel):
    sai_version: str = "0.0.2"
    project: ProjectMeta = ProjectMeta()
    trees: dict[str, TreeData] = Field(default_factory=lambda: {
        "functional": TreeData(label="Дерево функционала", description="Что продукт делает"),
        "development": TreeData(label="Дерево разработки", description="Как продукт создается"),
        "business": TreeData(label="Дерево бизнес-логики", description="User Journey"),
    })
    view: ViewState = ViewState()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
