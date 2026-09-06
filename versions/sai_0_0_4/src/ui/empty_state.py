"""EmptyState — welcome overlay when the canvas has no nodes."""

from PySide6.QtWidgets import QGraphicsProxyWidget, QWidget, QVBoxLayout, QLabel
from PySide6.QtGui import QFont, QColor
from PySide6.QtCore import Qt

from src.utils.constants import TEXT, SUBTEXT0, SANTI, SURFACE0


class EmptyStateWidget(QWidget):
    """Centered welcome card with keyboard shortcuts."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedSize(420, 260)

        layout = QVBoxLayout(self)
        layout.setSpacing(8)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Добро пожаловать в Sai")
        title.setFont(QFont("JetBrains Mono", 14, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)

        hints = [
            "⬡  Двойной клик по холсту — создать узел",
            "🔗  Тяни от правого розового порта к левому — связь",
            "✋  Space + ЛКМ — панорамирование (Pan)",
            "🔎  Ctrl+L — фокус на чат с ИИ",
            "⌨  Ctrl+B — Focus Mode (скрыть панели)",
        ]
        for hint in hints:
            lbl = QLabel(hint)
            lbl.setFont(QFont("JetBrains Mono", 10))
            lbl.setStyleSheet(f"color: {SUBTEXT0};")
            layout.addWidget(lbl)

        self.setStyleSheet(f"""
            EmptyStateWidget {{
                background: {SURFACE0};
                border: 1px solid {SANTI};
                border-radius: 8px;
            }}
            QLabel {{
                color: {TEXT};
            }}
        """)


class EmptyStateOverlay(QGraphicsProxyWidget):
    """Graphics proxy wrapping the empty state widget."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWidget(EmptyStateWidget())
        self.setZValue(100)
        self.setFlag(self.GraphicsItemFlag.ItemIgnoresTransformations, False)

    def center_in_scene(self, scene_rect):
        w, h = 420, 260
        self.setPos(scene_rect.center().x() - w / 2, scene_rect.center().y() - h / 2)

    def set_visible_for_empty(self, is_empty: bool):
        self.setVisible(is_empty)
