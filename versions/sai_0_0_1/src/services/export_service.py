"""ExportService — generates Markdown Technical Specification from the graph."""

from datetime import datetime

from src.services.prompt_templates import PromptTemplates
from src.core import GraphEngine


class ExportService:
    """Walks the functional tree and generates a TZ document."""

    def generate(self, engine: GraphEngine) -> str:
        """Generate a full Markdown TZ from the graph."""
        project = engine.project.project
        lines = []

        # Title
        lines.append(f"# Техническое задание: {project.name}")
        lines.append("")
        lines.append(f"> **Сгенерировано:** Sai v{engine.project.sai_version}")
        lines.append(f"> **Дата:** {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"> **Описание:** {project.description or 'Не указано'}")
        lines.append("")
        lines.append("---")
        lines.append("")

        # Functional requirements
        lines.append("## 1. Функциональные требования")
        lines.append("")

        nodes = engine.get_nodes_by_tree("functional")
        edges = engine.get_edges_for_tree("functional")
        processed = set()

        # Build parent-child map
        children_map = {}
        for edge in edges:
            if edge.edge_type == "parent":
                if edge.source_id not in children_map:
                    children_map[edge.source_id] = []
                children_map[edge.source_id].append(edge.target_id)

        # Root nodes first, then children
        root_nodes = [n for n in nodes if n.id not in {e.target_id for e in edges if e.edge_type == "parent"}]

        if not root_nodes:
            root_nodes = nodes

        for node in root_nodes:
            if node.id in processed:
                continue
            self._write_node(lines, node, engine, children_map, processed, level=2)

        lines.append("")
        lines.append("---")
        lines.append("")

        # Architecture section (from development tree)
        lines.append("## 2. Архитектура")
        lines.append("")

        dev_nodes = engine.get_nodes_by_tree("development")
        if dev_nodes:
            for node in dev_nodes:
                if node.id not in processed:
                    # We don't add to processed here since it's a different tree
                    lines.append(f"### {node.label}")
                    if node.description:
                        lines.append(f"")
                        lines.append(f"{node.description}")
                    lines.append(f"")
        else:
            lines.append("*Дерево разработки пустое. Добавьте узлы для генерации раздела архитектуры.*")
            lines.append("")

        lines.append("---")
        lines.append("")

        # User journey (from business tree)
        lines.append("## 3. Пользовательский путь (User Journey)")
        lines.append("")

        biz_nodes = engine.get_nodes_by_tree("business")
        if biz_nodes:
            for node in biz_nodes:
                lines.append(f"- **{node.label}** — {node.description or 'Нет описания'}")
            lines.append("")
        else:
            lines.append("*Дерево бизнес-логики пустое.*")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("> **Сгенерировано автоматически в Sai.**")
        lines.append("")

        return "\n".join(lines)

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

        # Connected nodes (dependencies)
        connected = engine.get_connected_nodes(node.id)
        if connected:
            lines.append("**Связанные узлы:**")
            for cn in connected:
                lines.append(f"- {cn.label} — {cn.description or 'Нет описания'}")
            lines.append("")

        # Children
        for child_id in children_map.get(node.id, []):
            child = engine.get_node(child_id)
            if child:
                self._write_node(lines, child, engine, children_map, processed, level + 1)
