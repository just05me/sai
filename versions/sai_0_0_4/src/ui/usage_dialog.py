"""UsageDialog — token/cost usage report window."""

from PySide6.QtWidgets import QDialog, QVBoxLayout, QLabel, QTextEdit, QPushButton
from PySide6.QtGui import QFont


class UsageDialog(QDialog):
    def __init__(self, usage_stats: dict, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Usage")
        self.resize(700, 480)

        layout = QVBoxLayout(self)
        title = QLabel("Usage: токены, история, расходы")
        title.setFont(QFont("Inter", 12, QFont.Bold))
        layout.addWidget(title)

        total_requests = usage_stats.get("total_requests", 0)
        total_in = usage_stats.get("total_input_tokens", 0)
        total_out = usage_stats.get("total_output_tokens", 0)
        estimated_cost = usage_stats.get("estimated_cost", 0.0)

        summary = QLabel(
            f"Запросов: {total_requests} | "
            f"Input токены: {total_in} | "
            f"Output токены: {total_out} | "
            f"Оценка стоимости: ${estimated_cost:.4f}"
        )
        layout.addWidget(summary)

        history_box = QTextEdit()
        history_box.setReadOnly(True)
        lines = []
        for row in usage_stats.get("history", []):
            lines.append(
                f"[{row.get('time', '')}] {row.get('provider', '')}/{row.get('model', '')} "
                f"mode={row.get('mode', 'qa')} "
                f"in={row.get('input_tokens', 0)} out={row.get('output_tokens', 0)} "
                f"cost=${row.get('estimated_cost', 0.0):.5f}"
            )
        history_box.setPlainText("\n".join(lines) if lines else "История пока пуста.")
        layout.addWidget(history_box, 1)

        close_btn = QPushButton("Закрыть")
        close_btn.clicked.connect(self.accept)
        layout.addWidget(close_btn)
