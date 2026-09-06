"""MetricsService — compute project statistics."""

from src.core.models import ProjectMetrics, SaiProject


def compute_metrics(project: SaiProject) -> ProjectMetrics:
    """Aggregate node counts by tree, status, and type."""
    total = 0
    by_tree: dict[str, int] = {}
    by_status: dict[str, int] = {}
    by_type: dict[str, int] = {}

    for tname, tree in project.trees.items():
        count = len(tree.nodes)
        total += count
        if count > 0:
            by_tree[tname] = count
        for node in tree.nodes.values():
            status = node.status or "draft"
            by_status[status] = by_status.get(status, 0) + 1
            ntype = node.type or "feature"
            by_type[ntype] = by_type.get(ntype, 0) + 1

    return ProjectMetrics(
        total_nodes=total,
        nodes_by_tree=by_tree,
        nodes_by_status=by_status,
        nodes_by_type=by_type,
    )
