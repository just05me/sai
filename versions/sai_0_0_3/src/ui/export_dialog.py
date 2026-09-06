"""ExportDialog — UX-friendly themed export dialog with format selector."""

from __future__ import annotations

import os
from datetime import datetime

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QTreeWidget, QTreeWidgetItem, QFileDialog,
    QMessageBox, QFrame, QLineEdit, QComboBox, QToolButton,
)
from PySide6.QtCore import Qt, QPoint, Signal
from PySide6.QtGui import QFont

from src.services.export_service import ExportService
from src.utils.constants import (
    MANTLE, SURFACE0, SURFACE1, TEXT, SUBTEXT0, SANTI,
    LIGHT_MANTLE, LIGHT_TEXT, LIGHT_SUBTEXT, LIGHT_SURFACE0, LIGHT_SURFACE1,
    TREE_NAMES,
)


FONT_TITLE = QFont("Inter", 13, QFont.Bold)
FONT_SECTION = QFont("Inter", 10, QFont.Bold)
FONT_TEXT = QFont("Inter", 10)
FONT_HINT = QFont("Inter", 9)


TREE_ICONS = {
    "functional": "🌳",
    "development": "🛠",
    "business": "👤",
}


class ExportDialog(QDialog):
    """Frameless themed export dialog with selection summary and presets."""

    def __init__(self, engine, parent=None):
        super().__init__(parent)
        self._engine = engine
        self._is_dark = True
        if parent and hasattr(parent, "_is_dark"):
            self._is_dark = parent._is_dark

        self._drag_pos: QPoint | None = None

        self.setWindowTitle("Экспорт ТЗ")
        self.setWindowFlags(Qt.Dialog | Qt.FramelessWindowHint)
        self.setModal(True)
        self.resize(640, 600)
        self.setMinimumSize(560, 480)

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        self._frame = QFrame(self)
        self._frame.setObjectName("exportFrame")
        outer.addWidget(self._frame)

        layout = QVBoxLayout(self._frame)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # ---- Title bar (draggable) ----
        self._title_bar = QFrame()
        self._title_bar.setObjectName("exportTitleBar")
        self._title_bar.setFixedHeight(44)
        self._title_bar.installEventFilter(self)
        tbl = QHBoxLayout(self._title_bar)
        tbl.setContentsMargins(16, 0, 8, 0)
        tbl.setSpacing(8)

        title_lbl = QLabel("📄  Экспорт технического задания")
        title_lbl.setFont(FONT_TITLE)
        tbl.addWidget(title_lbl)
        tbl.addStretch()

        close_btn = QToolButton()
        close_btn.setText("✕")
        close_btn.setObjectName("closeBtn")
        close_btn.setFixedSize(28, 28)
        close_btn.setCursor(Qt.PointingHandCursor)
        close_btn.clicked.connect(self.reject)
        tbl.addWidget(close_btn)
        layout.addWidget(self._title_bar)

        # ---- Body ----
        body = QVBoxLayout()
        body.setContentsMargins(20, 14, 20, 14)
        body.setSpacing(12)

        # Step 1: trees/nodes selection
        step1 = QLabel("1. Что включить в экспорт")
        step1.setFont(FONT_SECTION)
        body.addWidget(step1)

        # Quick-select toolbar
        quick_row = QHBoxLayout()
        quick_row.setSpacing(6)

        self._select_all_btn = QPushButton("Выбрать всё")
        self._select_all_btn.setObjectName("ghostBtn")
        self._select_all_btn.setCursor(Qt.PointingHandCursor)
        self._select_all_btn.clicked.connect(self._select_all)
        quick_row.addWidget(self._select_all_btn)

        self._deselect_all_btn = QPushButton("Снять всё")
        self._deselect_all_btn.setObjectName("ghostBtn")
        self._deselect_all_btn.setCursor(Qt.PointingHandCursor)
        self._deselect_all_btn.clicked.connect(self._deselect_all)
        quick_row.addWidget(self._deselect_all_btn)

        self._only_active_btn = QPushButton("Только активное дерево")
        self._only_active_btn.setObjectName("ghostBtn")
        self._only_active_btn.setCursor(Qt.PointingHandCursor)
        self._only_active_btn.clicked.connect(self._select_only_active)
        quick_row.addWidget(self._only_active_btn)

        quick_row.addStretch()
        body.addLayout(quick_row)

        self._tree = QTreeWidget()
        self._tree.setHeaderHidden(True)
        self._tree.setIndentation(20)
        self._tree.setAnimated(True)
        self._tree.setUniformRowHeights(True)
        self._tree.itemChanged.connect(self._on_item_changed)
        self._populate_tree()
        body.addWidget(self._tree, 1)

        # Selection summary
        self._summary_label = QLabel("")
        self._summary_label.setFont(FONT_HINT)
        self._summary_label.setObjectName("summaryLabel")
        body.addWidget(self._summary_label)

        # Step 2: format / target
        step2 = QLabel("2. Формат и место сохранения")
        step2.setFont(FONT_SECTION)
        body.addWidget(step2)

        format_row = QHBoxLayout()
        format_row.setSpacing(8)
        format_row.addWidget(QLabel("Формат:"))
        self._format_combo = QComboBox()
        self._format_combo.addItem("Markdown (.md)", "md")
        self._format_combo.addItem("Plain text (.txt)", "txt")
        self._format_combo.setMinimumHeight(30)
        format_row.addWidget(self._format_combo, 1)
        body.addLayout(format_row)

        path_row = QHBoxLayout()
        path_row.setSpacing(6)
        self._path_edit = QLineEdit()
        self._path_edit.setPlaceholderText("Куда сохранить файл…")
        self._path_edit.setMinimumHeight(30)
        path_row.addWidget(self._path_edit, 1)

        browse_btn = QPushButton("Обзор…")
        browse_btn.setObjectName("ghostBtn")
        browse_btn.setMinimumHeight(30)
        browse_btn.setCursor(Qt.PointingHandCursor)
        browse_btn.clicked.connect(self._browse)
        path_row.addWidget(browse_btn)

        body.addLayout(path_row)

        # Initial path suggestion
        self._set_default_path()
        self._format_combo.currentIndexChanged.connect(self._update_path_extension)

        layout.addLayout(body)

        # ---- Footer with primary action ----
        footer = QFrame()
        footer.setObjectName("exportFooter")
        footer.setFixedHeight(64)
        fl = QHBoxLayout(footer)
        fl.setContentsMargins(20, 12, 20, 12)
        fl.setSpacing(10)

        self._cancel_btn = QPushButton("Отмена")
        self._cancel_btn.setObjectName("ghostBtn")
        self._cancel_btn.setMinimumHeight(36)
        self._cancel_btn.setMinimumWidth(120)
        self._cancel_btn.setCursor(Qt.PointingHandCursor)
        self._cancel_btn.clicked.connect(self.reject)
        fl.addWidget(self._cancel_btn)

        fl.addStretch()

        self._export_btn = QPushButton("📥  Экспортировать")
        self._export_btn.setObjectName("primaryBtn")
        self._export_btn.setMinimumHeight(36)
        self._export_btn.setMinimumWidth(180)
        self._export_btn.setCursor(Qt.PointingHandCursor)
        self._export_btn.setDefault(True)
        self._export_btn.clicked.connect(self._on_export)
        fl.addWidget(self._export_btn)

        layout.addWidget(footer)

        self._apply_style()
        self._update_summary()

    # ---- Styling ----

    def _apply_style(self):
        if self._is_dark:
            bg = MANTLE
            surf = SURFACE0
            border = SURFACE1
            text = TEXT
            subtext = SUBTEXT0
            divider = "#313244"
        else:
            bg = LIGHT_MANTLE
            surf = LIGHT_SURFACE0
            border = LIGHT_SURFACE1
            text = LIGHT_TEXT
            subtext = LIGHT_SUBTEXT
            divider = LIGHT_SURFACE1

        self.setStyleSheet(f"""
            QDialog {{ background: transparent; }}
            #exportFrame {{
                background: {bg};
                border: 1px solid {border};
                border-radius: 12px;
            }}
            #exportTitleBar {{
                background: {bg};
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                border-bottom: 1px solid {divider};
            }}
            #exportFooter {{
                background: {bg};
                border-top: 1px solid {divider};
                border-bottom-left-radius: 12px;
                border-bottom-right-radius: 12px;
            }}
            QLabel {{
                color: {text};
                background: transparent;
            }}
            #summaryLabel {{
                color: {subtext};
                padding: 2px 0;
            }}
            QToolButton#closeBtn {{
                background: transparent;
                color: {text};
                border: none;
                border-radius: 6px;
                font-size: 14px;
            }}
            QToolButton#closeBtn:hover {{
                background: #e64553;
                color: white;
            }}
            QTreeWidget {{
                background: {surf};
                border: 1px solid {border};
                border-radius: 8px;
                color: {text};
                padding: 4px;
                outline: none;
            }}
            QTreeWidget::item {{
                padding: 6px 4px;
                border-radius: 4px;
                color: {text};
            }}
            QTreeWidget::item:hover {{ background: {SANTI}30; }}
            QTreeWidget::item:selected {{ background: {SANTI}; color: white; }}
            QTreeWidget::indicator {{
                width: 16px;
                height: 16px;
            }}
            QLineEdit, QComboBox {{
                background: {surf};
                border: 1px solid {border};
                border-radius: 6px;
                padding: 6px 10px;
                color: {text};
            }}
            QComboBox::drop-down {{ border: none; width: 22px; }}
            QComboBox QAbstractItemView {{
                background: {surf};
                color: {text};
                selection-background-color: {SANTI};
                selection-color: white;
                border: 1px solid {border};
            }}
            QPushButton#ghostBtn {{
                background: transparent;
                color: {text};
                border: 1px solid {border};
                border-radius: 6px;
                padding: 6px 14px;
            }}
            QPushButton#ghostBtn:hover {{
                background: {surf};
                border-color: {SANTI};
                color: {text};
            }}
            QPushButton#primaryBtn {{
                background: {SANTI};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 22px;
                font-weight: bold;
            }}
            QPushButton#primaryBtn:hover {{
                background: #8a4066;
            }}
            QPushButton#primaryBtn:disabled {{
                background: {border};
                color: {subtext};
            }}
            QScrollBar:vertical {{
                background: transparent; width: 8px; margin: 0;
            }}
            QScrollBar::handle:vertical {{
                background: {border}; min-height: 24px; border-radius: 4px;
            }}
            QScrollBar::handle:vertical:hover {{ background: {SANTI}; }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
        """)

    # ---- Tree population & selection ----

    def _populate_tree(self):
        self._tree.blockSignals(True)
        self._tree.clear()
        for tname, tlabel in TREE_NAMES.items():
            icon = TREE_ICONS.get(tname, "•")
            tree_item = QTreeWidgetItem(self._tree)
            tree_item.setText(0, f"{icon}  {tlabel}")
            tree_item.setData(0, Qt.UserRole, f"tree:{tname}")
            tree_item.setFlags(
                tree_item.flags()
                | Qt.ItemIsUserCheckable
                | Qt.ItemIsAutoTristate
            )
            tree_item.setCheckState(0, Qt.Checked)

            nodes = self._engine.get_nodes_by_tree(tname)
            for node in nodes:
                node_item = QTreeWidgetItem(tree_item)
                label = node.label[:60] if node.label else "(без названия)"
                node_item.setText(0, f"●  {label}")
                node_item.setData(0, Qt.UserRole, f"node:{tname}:{node.id}")
                node_item.setFlags(node_item.flags() | Qt.ItemIsUserCheckable)
                node_item.setCheckState(0, Qt.Checked)

            tree_item.setExpanded(True)
        self._tree.blockSignals(False)

    def _select_all(self):
        self._set_all_checks(Qt.Checked)

    def _deselect_all(self):
        self._set_all_checks(Qt.Unchecked)

    def _select_only_active(self):
        active = self._engine.active_tree
        self._tree.blockSignals(True)
        for i in range(self._tree.topLevelItemCount()):
            tree_item = self._tree.topLevelItem(i)
            data = tree_item.data(0, Qt.UserRole) or ""
            tname = data.split(":", 1)[1] if data.startswith("tree:") else ""
            state = Qt.Checked if tname == active else Qt.Unchecked
            tree_item.setCheckState(0, state)
            for j in range(tree_item.childCount()):
                tree_item.child(j).setCheckState(0, state)
        self._tree.blockSignals(False)
        self._update_summary()

    def _set_all_checks(self, state):
        self._tree.blockSignals(True)

        def recurse(item):
            item.setCheckState(0, state)
            for i in range(item.childCount()):
                recurse(item.child(i))

        for i in range(self._tree.topLevelItemCount()):
            recurse(self._tree.topLevelItem(i))
        self._tree.blockSignals(False)
        self._update_summary()

    def _on_item_changed(self, item, _column):
        self._update_summary()

    def _update_summary(self):
        trees, nodes_map = self._get_selected()
        node_count = sum(len(v) for v in nodes_map.values())
        if not trees:
            self._summary_label.setText("⚠  Ничего не выбрано")
            self._export_btn.setEnabled(False)
        else:
            tree_labels = ", ".join(TREE_NAMES.get(t, t) for t in trees)
            self._summary_label.setText(
                f"Выбрано: {len(trees)} дер. · {node_count} узл.   "
                f"({tree_labels})"
            )
            self._export_btn.setEnabled(True)

    # ---- Path / format ----

    def _set_default_path(self):
        parent = self.parent()
        proj_path = ""
        if parent and hasattr(parent, "_current_project_path"):
            proj_path = parent._current_project_path or ""

        proj_name = "ТЗ"
        if proj_path:
            proj_name = os.path.basename(proj_path) or "ТЗ"
        elif self._engine and getattr(self._engine, "project", None):
            try:
                proj_name = self._engine.project.project.name or "ТЗ"
            except AttributeError:
                pass

        ts = datetime.now().strftime("%Y-%m-%d")
        ext = self._format_combo.currentData() or "md"
        fname = f"ТЗ_{proj_name}_{ts}.{ext}"

        base = proj_path or os.path.expanduser("~")
        self._path_edit.setText(os.path.join(base, fname))

    def _update_path_extension(self):
        path = self._path_edit.text().strip()
        if not path:
            return
        new_ext = self._format_combo.currentData() or "md"
        root, _ = os.path.splitext(path)
        self._path_edit.setText(f"{root}.{new_ext}")

    def _browse(self):
        ext = self._format_combo.currentData() or "md"
        ext_filter = "Markdown (*.md)" if ext == "md" else "Plain text (*.txt)"
        current = self._path_edit.text().strip() or os.path.expanduser("~")
        path, _ = QFileDialog.getSaveFileName(
            self, "Сохранить ТЗ", current, ext_filter,
        )
        if path:
            self._path_edit.setText(path)

    # ---- Selection model ----

    def _get_selected(self):
        selected_trees = set()
        selected_nodes: dict[str, list[str]] = {}

        for i in range(self._tree.topLevelItemCount()):
            tree_item = self._tree.topLevelItem(i)
            data = tree_item.data(0, Qt.UserRole)
            if not data or not data.startswith("tree:"):
                continue
            tname = data.split(":", 1)[1]

            tree_state = tree_item.checkState(0)
            has_checked_nodes = False
            for j in range(tree_item.childCount()):
                child = tree_item.child(j)
                if child.checkState(0) == Qt.Checked:
                    has_checked_nodes = True
                    ndata = child.data(0, Qt.UserRole)
                    if ndata and ndata.startswith("node:"):
                        parts = ndata.split(":", 2)
                        if len(parts) == 3:
                            selected_nodes.setdefault(parts[1], []).append(parts[2])

            if tree_state != Qt.Unchecked or has_checked_nodes:
                selected_trees.add(tname)

        return selected_trees, selected_nodes

    # ---- Export action ----

    def _on_export(self):
        selected_trees, selected_nodes = self._get_selected()
        if not selected_trees:
            QMessageBox.warning(
                self, "Экспорт",
                "Выберите хотя бы одно дерево или узел для экспорта.",
            )
            return

        path = self._path_edit.text().strip()
        if not path:
            QMessageBox.warning(self, "Экспорт", "Укажите путь для сохранения файла.")
            return

        try:
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        except OSError as e:
            QMessageBox.warning(self, "Ошибка", f"Не удалось создать каталог:\n{e}")
            return

        md = ExportService().generate(self._engine, selected_trees, selected_nodes)

        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(md)
        except OSError as e:
            QMessageBox.warning(self, "Ошибка", str(e))
            return

        QMessageBox.information(self, "Готово", f"ТЗ сохранено:\n{path}")
        self.accept()

    # ---- Drag (for the frameless dialog) ----

    def eventFilter(self, obj, event):
        if obj is self._title_bar:
            t = event.type()
            if t == event.Type.MouseButtonPress and event.button() == Qt.LeftButton:
                self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
                return True
            if t == event.Type.MouseMove and self._drag_pos and (event.buttons() & Qt.LeftButton):
                self.move(event.globalPosition().toPoint() - self._drag_pos)
                return True
            if t == event.Type.MouseButtonRelease:
                self._drag_pos = None
                return True
        return super().eventFilter(obj, event)
