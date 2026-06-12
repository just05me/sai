"""LoadingIndicator — blinking terminal cursor | for streaming."""

from PySide6.QtWidgets import QWidget, QHBoxLayout, QLabel
from PySide6.QtCore import QPropertyAnimation
from PySide6.QtGui import QFont

from src.utils.constants import SUBTEXT0, SANTI


class LoadingIndicator(QWidget):
    """Blinking cursor | at end of generation."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._cursor = QLabel("|")
        self._cursor.setFont(QFont("JetBrains Mono", 12, QFont.Bold))
        self._cursor.setStyleSheet(f"color: {SANTI};")

        layout = QHBoxLayout(self)
        layout.setContentsMargins(12, 4, 12, 4)
        layout.addWidget(QLabel("Sai"))
        layout.addWidget(self._cursor)
        layout.addStretch()

        self._anim = QPropertyAnimation(self._cursor, b"windowOpacity")
        self._anim.setDuration(500)
        self._anim.setStartValue(1.0)
        self._anim.setEndValue(0.0)
        self._anim.setLoopCount(-1)

    def start(self):
        self.show()
        self._anim.start()

    def stop(self):
        self._anim.stop()
        self._cursor.setWindowOpacity(1.0)
        self.hide()
