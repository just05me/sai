"""TemplateService — save/load/list/delete project templates."""

import json
import os
from typing import Optional
from uuid import uuid4

from src.core.models import ProjectTemplate, SaiProject
from src.utils.logger import Logger


TEMPLATES_DIR = os.path.expanduser("~/.sai/templates")


class TemplateService:
    """Manages project templates stored as JSON files in ~/.sai/templates/."""

    def __init__(self):
        self.log = Logger.get()
        self._ensure_dir()

    @staticmethod
    def _ensure_dir():
        os.makedirs(TEMPLATES_DIR, exist_ok=True)

    def _path(self, template_id: str) -> str:
        return os.path.join(TEMPLATES_DIR, f"{template_id}.json")

    def save(self, project: SaiProject, name: str, description: str = "") -> str:
        """Save current project as a template. Returns template id."""
        from src.core.models import now_iso
        tid = str(uuid4())
        template = ProjectTemplate(
            id=tid,
            name=name,
            description=description,
            created_at=now_iso(),
            trees=project.trees,
        )
        try:
            with open(self._path(tid), "w", encoding="utf-8") as f:
                json.dump(template.model_dump(), f, indent=2, ensure_ascii=False)
            self.log.info(f"Template saved: {name} ({tid})")
            return tid
        except OSError as e:
            self.log.error(f"Failed to save template: {e}")
            return ""

    def load(self, template_id: str) -> Optional[ProjectTemplate]:
        """Load a template by id."""
        path = self._path(template_id)
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ProjectTemplate(**data)
        except (OSError, json.JSONDecodeError) as e:
            self.log.error(f"Failed to load template {template_id}: {e}")
            return None

    def delete(self, template_id: str) -> bool:
        path = self._path(template_id)
        if os.path.exists(path):
            try:
                os.remove(path)
                self.log.info(f"Template deleted: {template_id}")
                return True
            except OSError as e:
                self.log.error(f"Failed to delete template: {e}")
        return False

    def list_all(self) -> list[ProjectTemplate]:
        self._ensure_dir()
        templates = []
        try:
            for fname in os.listdir(TEMPLATES_DIR):
                if not fname.endswith(".json"):
                    continue
                path = os.path.join(TEMPLATES_DIR, fname)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    templates.append(ProjectTemplate(**data))
                except (OSError, json.JSONDecodeError):
                    continue
        except OSError:
            pass
        templates.sort(key=lambda t: t.created_at, reverse=True)
        return templates

    def apply_to_project(self, template: ProjectTemplate, project: SaiProject) -> SaiProject:
        """Copy template trees into a project. Returns modified project."""
        for tname, tree_data in template.trees.items():
            if tname in project.trees:
                project.trees[tname] = tree_data
        return project
