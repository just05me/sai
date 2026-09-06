"""LLMService — async HTTP client for OpenAI-compatible APIs."""

import json
import httpx
from PySide6.QtCore import QObject, Signal, QThread, QRunnable, Slot

from src.services.prompt_templates import PromptTemplates
from src.utils.logger import Logger


class LLMTask(QRunnable):
    """Background task for LLM API calls (runs in QThreadPool)."""

    def __init__(self, api_key: str, base_url: str, model: str,
                 messages: list[dict], node_id: str):
        super().__init__()
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.messages = messages
        self.node_id = node_id
        self.signals = None  # set by LLMService

    @Slot()
    def run(self):
        try:
            with httpx.Client(timeout=60) as client:
                resp = client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": self.messages,
                        "temperature": 0.7,
                        "max_tokens": 4096,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    if self.signals:
                        self.signals.finished.emit(self.node_id, content, "")
                else:
                    error = f"API error {resp.status_code}: {resp.text[:200]}"
                    if self.signals:
                        self.signals.finished.emit(self.node_id, "", error)
        except Exception as e:
            if self.signals:
                self.signals.finished.emit(self.node_id, "", str(e))


class LLMSignals(QObject):
    """Signals for LLM background tasks."""
    finished = Signal(str, str, str)  # node_id, response, error


class LLMService(QObject):
    """Async LLM API service. Uses QThreadPool for background requests."""

    response_received = Signal(str, str)      # node_id, response_text
    response_error = Signal(str, str)         # node_id, error_message
    connection_tested = Signal(bool, str)     # success, message

    def __init__(self, parent=None):
        super().__init__(parent)
        self.log = Logger.get()
        self._pool = QThreadPool.globalInstance()
        self._api_key = ""
        self._base_url = "https://api.openai.com/v1"
        self._model = "gpt-4o"
        self._tasks: dict[str, LLMTask] = {}

    def configure(self, api_key: str, base_url: str, model: str):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self.log.info(f"LLM configured: {model} @ {base_url}")

    def send_message(self, node_id: str, message: str, context: dict = None):
        """Send a chat message to the LLM."""
        if not self._api_key:
            self.response_error.emit(node_id, "API ключ не настроен")
            return

        messages = [{"role": "user", "content": message}]
        if context and "system" in context:
            messages.insert(0, {"role": "system", "content": context["system"]})

        task = LLMTask(
            self._api_key, self._base_url, self._model, messages, node_id
        )
        signals = LLMSignals()
        signals.finished.connect(self._on_task_finished)
        task.signals = signals
        self._tasks[node_id] = task
        self._pool.start(task)

    def cancel_request(self, node_id: str):
        """Cancel a pending request (best-effort)."""
        if node_id in self._tasks:
            del self._tasks[node_id]

    def _on_task_finished(self, node_id: str, response: str, error: str):
        if error:
            self.response_error.emit(node_id, error)
        else:
            self.response_received.emit(node_id, response)
        self._tasks.pop(node_id, None)

    def get_config(self) -> dict:
        return {
            "api_key": self._api_key[:8] + "..." if self._api_key else "",
            "base_url": self._base_url,
            "model": self._model,
        }
