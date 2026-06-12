"""FileStore — reads and writes projects to disk (Repository pattern)."""

import json
import os
import shutil
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
                    f.write(f"sai_version=0.0.2\ncreated={name}\n")
            self._project_path = path
            self.log.info(f"Project created at {path}")
            return True
        except OSError as e:
            self.log.error(f"Failed to create project: {e}")
            return False

    def load_project(self, path: str) -> Optional[dict]:
        """Load tree.json from a project directory."""
        tree_file = os.path.join(path, "tree.json")
        if not os.path.exists(tree_file):
            self.log.warning(f"No tree.json found at {tree_file}")
            return None
        try:
            with open(tree_file, "r") as f:
                data = json.load(f)
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
