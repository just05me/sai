"""LoadingIndicator — animated dots for AI response waiting state."""

from PySide6.QtWidgets import QWidget, QHBoxLayout, QLabel
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QFont

from src.utils.constants import SUBTEXT0


class LoadingIndicator(QWidget):
    """Three animated dots indicating AI is thinking."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._label = QLabel("Sai печатает")
        self._label.setStyleSheet(f"color: {SUBTEXT0}; font-size: 11px;")
        self._dots = QLabel(".")
        self._dots.setStyleSheet(f"color: {SUBTEXT0}; font-size: 11px;")

        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 4, 10, 4)
        layout.addWidget(self._label)
        layout.addWidget(self._dots)
        layout.addStretch()

        self._dot_count = 0
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._animate)
        self._timer.start(400)

    def _animate(self):
        self._dot_count = (self._dot_count + 1) % 4
        self._dots.setText("." * self._dot_count)

    def stop(self):
        self._timer.stop()
        self.hide()
