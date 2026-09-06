"""ExportService — generates Markdown Technical Specification from the graph."""

from datetime import datetime

from src.services.prompt_templates import PromptTemplates
from src.core import GraphEngine


TREE_SECTIONS = {
    "functional": ("1. Функциональные требования", True),
    "development": ("2. Архитектура", False),
    "business": ("3. Пользовательский путь (User Journey)", False),
}


class ExportService:
    """Walks the selected trees and generates a TZ document."""

    def generate(self, engine: GraphEngine,
                 selected_trees: set | None = None,
                 selected_nodes: dict | None = None) -> str:
        """Generate a Markdown TZ from selected trees and nodes.

        Args:
            engine: The graph engine.
            selected_trees: Set of tree names to include. If None, all trees.
            selected_nodes: Dict of tree_name -> [node_id] to include.
                           If None, all nodes in selected trees.
        """
        project = engine.project.project
        lines = []

        if selected_trees is None:
            selected_trees = {"functional", "development", "business"}
        if selected_nodes is None:
            selected_nodes = {}

        # Title
        lines.append(f"# Техническое задание: {project.name}")
        lines.append("")
        lines.append(f"> **Сгенерировано:** Sai v{engine.project.sai_version}")
        lines.append(f"> **Дата:** {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"> **Описание:** {project.description or 'Не указано'}")
        lines.append("")
        lines.append("---")
        lines.append("")

        section_idx = 1
        for tname in ("functional", "development", "business"):
            if tname not in selected_trees:
                continue

            section_title, is_hierarchical = TREE_SECTIONS[tname]
            lines.append(f"## {section_title}")
            lines.append("")

            tree_nodes = engine.get_nodes_by_tree(tname)
            tree_edges = engine.get_edges_for_tree(tname)

            # Filter by selected node IDs if specified
            if tname in selected_nodes and selected_nodes[tname]:
                node_filter = set(selected_nodes[tname])
                tree_nodes = [n for n in tree_nodes if n.id in node_filter]
                tree_edges = [e for e in tree_edges
                              if e.source_id in node_filter and e.target_id in node_filter]

            if not tree_nodes:
                tlabel = {
                    "functional": "функциональное",
                    "development": "разработки",
                    "business": "бизнес-логики",
                }.get(tname, tname)
                lines.append(f"*Дерево {tlabel} пустое.*")
                lines.append("")
                lines.append("---")
                lines.append("")
                continue

            if is_hierarchical:
                self._write_hierarchical(lines, tree_nodes, tree_edges, engine)
            elif tname == "development":
                for node in tree_nodes:
                    lines.append(f"### {node.label}")
                    if node.description:
                        lines.append("")
                        lines.append(f"{node.description}")
                    lines.append("")
                for edge in tree_edges:
                    src = engine.get_node(edge.source_id)
                    tgt = engine.get_node(edge.target_id)
                    if src and tgt:
                        lines.append(f"- **{src.label}** → **{tgt.label}**"
                                     f"{' — ' + edge.label if edge.label else ''}")
                lines.append("")
            elif tname == "business":
                edges_out = {e.source_id: e for e in tree_edges}
                step_nodes = [n for n in tree_nodes
                              if n.id not in {e.target_id for e in tree_edges}]
                remaining = [n for n in tree_nodes if n not in step_nodes]
                step_nodes.extend(remaining)
                for i, node in enumerate(step_nodes, 1):
                    lines.append(f"{i}. **{node.label}** — {node.description or 'Нет описания'}")
                lines.append("")

            lines.append("---")
            lines.append("")

        lines.append("> **Сгенерировано автоматически в Sai.**")
        lines.append("")

        return "\n".join(lines)

    def _write_hierarchical(self, lines, nodes, edges, engine):
        """Write nodes hierarchically using parent-child relationships."""
        processed = set()

        children_map = {}
        for edge in edges:
            if edge.edge_type == "parent":
                children_map.setdefault(edge.source_id, []).append(edge.target_id)

        root_nodes = [
            n for n in nodes
            if n.id not in {e.target_id for e in edges if e.edge_type == "parent"}
        ]
        if not root_nodes:
            root_nodes = nodes

        for node in root_nodes:
            if node.id in processed:
                continue
            self._write_node(lines, node, engine, children_map, processed, level=2)

    def _write_node(self, lines, node, engine, children_map, processed, level=2):
        if node.id in processed:
            return
        processed.add(node.id)

        heading = "#" * level
        lines.append(f"{heading} {node.label}")
        lines.append("")
        if node.description:
            lines.append(f"**Описание:** {node.description}")
            lines.append("")
        lines.append(f"**Тип:** {node.type}")
        lines.append("")
        lines.append(f"**Статус:** {node.status}")
        lines.append("")

        connected = engine.get_connected_nodes(node.id)
        if connected:
            lines.append("**Связанные узлы:**")
            for cn in connected:
                lines.append(f"- {cn.label} — {cn.description or 'Нет описания'}")
            lines.append("")

        for child_id in children_map.get(node.id, []):
            child = engine.get_node(child_id)
            if child:
                self._write_node(lines, child, engine, children_map, processed, level + 1)
