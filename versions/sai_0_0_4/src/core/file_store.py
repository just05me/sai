"""FileStore — reads and writes projects to disk (Repository pattern)."""

import json
import os
import shutil
from datetime import datetime
from typing import Optional

from src.utils.logger import Logger


class FileStore:
    """Handles project I/O: tree.json, chats, backups."""

    def __init__(self):
        self._project_path: Optional[str] = None
        self.log = Logger.get()

    @property
    def project_path(self) -> Optional[str]:
        return self._project_path

    def create_project(self, path: str, name: str) -> bool:
        """Create a new project directory with .sai marker."""
        try:
            os.makedirs(path, exist_ok=True)
            os.makedirs(os.path.join(path, "chats"), exist_ok=True)
            marker = os.path.join(path, ".sai")
            if not os.path.exists(marker):
                with open(marker, "w") as f:
                    f.write(f"sai_version=0.0.6\ncreated={name}\n")
            self._project_path = path
            self.log.info(f"Project created at {path}")
            return True
        except OSError as e:
            self.log.error(f"Failed to create project: {e}")
            return False

    @staticmethod
    def migrate_schema(data: dict) -> dict:
        """Migrate project data from older schema versions to current.

        Handles: v0.0.3+ → v0.0.6 (schema_version, settings, cross_tree_edges, usage).
        """
        schema = data.get("schema_version", "")
        if schema >= "0.0.6":
            return data

        # Ensure tree structure
        for tname in ("functional", "development", "business"):
            if tname not in data.get("trees", {}):
                data.setdefault("trees", {})[tname] = {"nodes": {}, "edges": []}
            tree = data["trees"][tname]
            if "label" not in tree:
                tree["label"] = {"functional": "Дерево функционала",
                                  "development": "Дерево разработки",
                                  "business": "Дерево бизнес-логики"}.get(tname, tname)
            if "description" not in tree:
                descs = {"functional": "Что продукт делает",
                         "development": "Как продукт создается",
                         "business": "User Journey"}
                tree["description"] = descs.get(tname, "")

        # Add project settings defaults
        settings = data.setdefault("settings", {})
        settings.setdefault("autosave_enabled", True)
        settings.setdefault("autosave_interval_sec", 60)
        settings.setdefault("chat_keep_forever", True)
        settings.setdefault("default_chat_mode", "qa")
        settings.setdefault("ui_mode", "editor")
        settings.setdefault("default_export_format", "markdown")

        # Add cross_tree_edges
        if "cross_tree_edges" not in data:
            data["cross_tree_edges"] = []

        # Add usage stats
        usage_stats = data.setdefault("usage_stats", {})
        usage_stats.setdefault("total_requests", 0)
        usage_stats.setdefault("total_input_tokens", 0)
        usage_stats.setdefault("total_output_tokens", 0)
        usage_stats.setdefault("estimated_cost", 0.0)
        usage_stats.setdefault("history", [])

        # Ensure view state
        if "view" not in data:
            data["view"] = {}

        # Ensure project meta
        if "project" not in data:
            data["project"] = {"name": "Untitled", "description": ""}

        # Set schema version
        data["schema_version"] = "0.0.6"
        if "sai_version" not in data:
            data["sai_version"] = "0.0.3"

        return data

    def load_project(self, path: str) -> Optional[dict]:
        """Load tree.json from a project directory, with schema migration."""
        tree_file = os.path.join(path, "tree.json")
        if not os.path.exists(tree_file):
            self.log.warning(f"No tree.json found at {tree_file}")
            return None
        try:
            with open(tree_file, "r") as f:
                data = json.load(f)
            data = self.migrate_schema(data)
            self._project_path = path
            self.log.info(f"Project loaded from {path}")
            return data
        except (json.JSONDecodeError, OSError) as e:
            self.log.error(f"Failed to load tree.json: {e}")
            return None

    def save_tree(self, data: dict) -> bool:
        """Save tree.json to the project directory."""
        if not self._project_path:
            self.log.error("No project path set")
            return False
        tree_file = os.path.join(self._project_path, "tree.json")
        try:
            # Atomic write
            tmp = tree_file + ".tmp"
            with open(tmp, "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            shutil.move(tmp, tree_file)
            self.log.debug("tree.json saved")
            return True
        except OSError as e:
            self.log.error(f"Failed to save tree.json: {e}")
            return False

    def create_backup(self) -> Optional[str]:
        """Copy current tree.json → tree.json.bak."""
        if not self._project_path:
            return None
        src = os.path.join(self._project_path, "tree.json")
        if not os.path.exists(src):
            return None
        bak = os.path.join(self._project_path, "tree.json.bak")
        try:
            shutil.copy2(src, bak)
            self.log.debug("Backup created")
            return bak
        except OSError as e:
            self.log.error(f"Backup failed: {e}")
            return None

    def create_snapshot(self, max_snapshots: int = 20) -> Optional[str]:
        """Create timestamped snapshot for crash recovery with rotation."""
        if not self._project_path:
            return None
        src = os.path.join(self._project_path, "tree.json")
        if not os.path.exists(src):
            return None
        snapshots_dir = os.path.join(self._project_path, "snapshots")
        os.makedirs(snapshots_dir, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dst = os.path.join(snapshots_dir, f"tree_{stamp}.json")
        try:
            shutil.copy2(src, dst)
            files = sorted(
                [
                    os.path.join(snapshots_dir, f)
                    for f in os.listdir(snapshots_dir)
                    if f.startswith("tree_") and f.endswith(".json")
                ]
            )
            if len(files) > max_snapshots:
                for old in files[: len(files) - max_snapshots]:
                    try:
                        os.remove(old)
                    except OSError:
                        pass
            return dst
        except OSError as e:
            self.log.error(f"Snapshot failed: {e}")
            return None

    def load_chat(self, node_id: str) -> str:
        """Load chat content for a node."""
        if not self._project_path:
            return ""
        chat_file = os.path.join(self._project_path, "chats", f"{node_id}.md")
        if not os.path.exists(chat_file):
            return ""
        try:
            with open(chat_file, "r") as f:
                return f.read()
        except OSError:
            return ""

    def save_chat(self, node_id: str, content: str) -> bool:
        """Save chat content for a node."""
        if not self._project_path:
            return False
        chat_dir = os.path.join(self._project_path, "chats")
        os.makedirs(chat_dir, exist_ok=True)
        chat_file = os.path.join(chat_dir, f"{node_id}.md")
        try:
            with open(chat_file, "w") as f:
                f.write(content)
            return True
        except OSError as e:
            self.log.error(f"Failed to save chat: {e}")
            return False

    def get_project_files(self) -> list[dict]:
        """List files in the project (for the explorer panel)."""
        if not self._project_path:
            return []
        result = []
        try:
            for fname in sorted(os.listdir(self._project_path)):
                fpath = os.path.join(self._project_path, fname)
                result.append({
                    "name": fname,
                    "path": fpath,
                    "is_dir": os.path.isdir(fpath),
                    "size": os.path.getsize(fpath) if os.path.isfile(fpath) else 0,
                })
        except OSError:
            pass
        return result
