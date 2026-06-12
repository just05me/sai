"""LLMService — async HTTP client with OpenAI + Anthropic support."""

import json
import httpx
from PySide6.QtCore import QObject, Signal, QRunnable, QThreadPool, Slot

from src.services.prompt_templates import PromptTemplates
from src.utils.logger import Logger


class LLMSignals(QObject):
    finished = Signal(str, str, str)
    stream_chunk = Signal(str, str)


def _parse_messages(messages: list[dict], api_type: str):
    """Convert internal message list to provider-specific format."""
    system = ""
    msgs = []
    for m in messages:
        if m.get("role") == "system":
            system += m["content"] + "\n"
        else:
            msgs.append({"role": m["role"], "content": m["content"]})

    if api_type == "anthropic":
        body = {"model": None, "messages": msgs, "max_tokens": 4096}
        if system.strip():
            body["system"] = system.strip()
        return body
    else:
        body = {"model": None, "messages": messages, "temperature": 0.7, "max_tokens": 4096}
        return body


def _build_headers(api_key: str, api_type: str) -> dict:
    if api_type == "anthropic":
        return {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _extract_content(data: dict, api_type: str) -> str | None:
    """Extract text content from provider response."""
    try:
        if api_type == "anthropic":
            blocks = data.get("content", [])
            return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        else:
            return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return None


def _extract_error(data: dict) -> str:
    err = data.get("error") if isinstance(data, dict) else None
    if isinstance(err, dict):
        return err.get("message", str(err)[:300])
    return str(data)[:300]


class LLMTask(QRunnable):
    """Background LLM request with streaming support (OpenAI + Anthropic)."""

    def __init__(self, api_key: str, base_url: str, model: str,
                 messages: list[dict], node_id: str,
                 stream: bool = False, api_type: str = "openai"):
        super().__init__()
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.messages = messages
        self.node_id = node_id
        self.stream = stream
        self.api_type = api_type
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

    def _endpoint(self) -> str:
        return f"{self.base_url}/messages" if self.api_type == "anthropic" else f"{self.base_url}/chat/completions"

    def _build_request(self, stream: bool = False) -> dict:
        body = _parse_messages(self.messages, self.api_type)
        body["model"] = self.model
        if stream:
            if self.api_type == "anthropic":
                body["stream"] = True
            else:
                body["stream"] = True
        return body

    def _run_sync(self, client):
        resp = client.post(
            self._endpoint(),
            headers=_build_headers(self.api_key, self.api_type),
            json=self._build_request(stream=False),
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
        content = _extract_content(data, self.api_type)
        if content is None:
            err_msg = _extract_error(data)
            if self.signals:
                self.signals.finished.emit(self.node_id, "", f"API: {err_msg}")
            return
        if self.signals:
            self.signals.finished.emit(self.node_id, content, "")

    def _run_stream(self, client):
        with client.stream(
            "POST", self._endpoint(),
            headers=_build_headers(self.api_key, self.api_type),
            json=self._build_request(stream=True),
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
            if self.api_type == "anthropic":
                full = self._stream_anthropic(resp)
            else:
                full = self._stream_openai(resp)
            if self.signals:
                self.signals.finished.emit(self.node_id, full, "")

    def _stream_openai(self, resp):
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
                if delta:
                    full += delta
                    if self.signals:
                        self.signals.stream_chunk.emit(self.node_id, delta)
            except (json.JSONDecodeError, KeyError, IndexError):
                continue
        return full

    def _stream_anthropic(self, resp):
        """Handle Anthropic SSE stream: event: content_block_delta"""
        full = ""
        current_event = ""
        buffer = ""

        # Anthropic SSE: lines can be event: / data: pairs
        for line in resp.iter_lines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("event: "):
                current_event = line[7:]
                continue
            if line.startswith("data: "):
                payload = line[6:]
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    continue

                if current_event == "content_block_delta":
                    delta = data.get("delta", {}).get("text", "")
                    if delta:
                        full += delta
                        if self.signals:
                            self.signals.stream_chunk.emit(self.node_id, delta)
                elif current_event == "message_stop":
                    break
                continue
        return full


class LLMService(QObject):
    """Async LLM API service via QThreadPool (OpenAI + Anthropic)."""

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
        self._api_type = "openai"

    def configure(self, api_key: str, base_url: str, model: str, api_type: str = "openai"):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._api_type = api_type

    def send_message(self, node_id: str, message: str, context: dict = None, stream: bool = True):
        if not self._api_key:
            self.response_error.emit(node_id, "API ключ не настроен. Откройте ⚙ Настройки.")
            return

        messages = []
        if context and context.get("system"):
            messages.append({"role": "system", "content": context["system"]})
        messages.append({"role": "user", "content": message})

        task = LLMTask(
            self._api_key, self._base_url, self._model,
            messages, node_id, stream, api_type=self._api_type,
        )
        signals = LLMSignals()
        signals.finished.connect(self._on_finished)
        signals.stream_chunk.connect(self.response_stream.emit)
        task.signals = signals
        self._pool.start(task)

    def send_brainstorm(self, idea: str, node_id: str = "global"):
        system = PromptTemplates.BRAINSTORM_SYSTEM
        self.send_message(node_id, idea, {"system": system}, stream=False)

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
