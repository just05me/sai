"""LLMService — async HTTP client with streaming support."""

import json
import httpx
from PySide6.QtCore import QObject, Signal, QRunnable, QThreadPool, Slot

from src.services.prompt_templates import PromptTemplates
from src.utils.logger import Logger


class LLMSignals(QObject):
    finished = Signal(str, str, str)
    stream_chunk = Signal(str, str)


class LLMTask(QRunnable):
    """Background LLM request with optional streaming."""

    def __init__(self, api_key: str, base_url: str, model: str,
                 messages: list[dict], node_id: str, stream: bool = False):
        super().__init__()
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.messages = messages
        self.node_id = node_id
        self.stream = stream
        self.signals: LLMSignals | None = None

    @Slot()
    def run(self):
        try:
            with httpx.Client(timeout=120) as client:
                if self.stream:
                    self._run_stream(client)
                else:
                    self._run_sync(client)
        except Exception as e:
            if self.signals:
                self.signals.finished.emit(self.node_id, "", str(e))

    def _run_sync(self, client):
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
        if resp.status_code != 200:
            if self.signals:
                self.signals.finished.emit(
                    self.node_id, "",
                    f"HTTP {resp.status_code}: {resp.text[:300] or '<пустой ответ>'}"
                )
            return
        try:
            data = resp.json()
        except json.JSONDecodeError:
            if self.signals:
                self.signals.finished.emit(
                    self.node_id, "",
                    f"API вернул не-JSON ответ. Проверьте Base URL и модель.\n"
                    f"Ответ: {resp.text[:300] or '<пусто>'}"
                )
            return
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            err = data.get("error") if isinstance(data, dict) else None
            err_msg = err.get("message") if isinstance(err, dict) else str(data)[:300]
            if self.signals:
                self.signals.finished.emit(self.node_id, "", f"API: {err_msg}")
            return
        if self.signals:
            self.signals.finished.emit(self.node_id, content, "")

    def _run_stream(self, client):
        with client.stream(
            "POST",
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
                "stream": True,
            },
        ) as resp:
            if resp.status_code != 200:
                body = resp.read().decode("utf-8", errors="replace")[:300]
                if self.signals:
                    self.signals.finished.emit(
                        self.node_id, "",
                        f"HTTP {resp.status_code}: {body or '<пусто>'}"
                    )
                return
            full = ""
            for line in resp.iter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    if delta and self.signals:
                        full += delta
                        self.signals.stream_chunk.emit(self.node_id, delta)
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
            if self.signals:
                self.signals.finished.emit(self.node_id, full, "")


class LLMService(QObject):
    """Async LLM API service via QThreadPool."""

    response_received = Signal(str, str)
    response_error = Signal(str, str)
    response_stream = Signal(str, str)
    connection_tested = Signal(bool, str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.log = Logger.get()
        self._pool = QThreadPool.globalInstance()
        self._api_key = ""
        self._base_url = "https://api.openai.com/v1"
        self._model = "gpt-4o"

    def configure(self, api_key: str, base_url: str, model: str):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    def send_message(self, node_id: str, message: str, context: dict = None, stream: bool = True):
        if not self._api_key:
            self.response_error.emit(node_id, "API ключ не настроен. Откройте ⚙ Настройки.")
            return

        messages = []
        if context and context.get("system"):
            messages.append({"role": "system", "content": context["system"]})
        messages.append({"role": "user", "content": message})

        task = LLMTask(self._api_key, self._base_url, self._model, messages, node_id, stream)
        signals = LLMSignals()
        signals.finished.connect(self._on_finished)
        signals.stream_chunk.connect(self.response_stream.emit)
        task.signals = signals
        self._pool.start(task)

    def send_brainstorm(self, idea: str, node_id: str = "global"):
        system = PromptTemplates.BRAINSTORM_SYSTEM
        self.send_message(node_id, idea, {"system": system}, stream=False)

    def test_connection(self) -> bool:
        if not self._api_key:
            self.connection_tested.emit(False, "API ключ не задан")
            return False
        try:
            with httpx.Client(timeout=10) as client:
                resp = client.post(
                    f"{self._base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json={
                        "model": self._model,
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 1,
                    },
                )
                ok = resp.status_code == 200
                self.connection_tested.emit(ok, "OK" if ok else resp.text[:100])
                return ok
        except Exception as e:
            self.connection_tested.emit(False, str(e))
            return False

    def _on_finished(self, node_id: str, response: str, error: str):
        if error:
            self.response_error.emit(node_id, error)
        elif response:
            self.response_received.emit(node_id, response)

    @staticmethod
    def try_parse_brainstorm_json(text: str) -> dict | None:
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end + 1])
                except json.JSONDecodeError:
                    pass
        return None
