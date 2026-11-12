"""Authenticated localhost-only gateway from Cloudflare Tunnel to Ollama."""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


OLLAMA_URL = os.environ.get("NEXUS_OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
ACCESS_TOKEN = os.environ.get("NEXUS_LOCAL_AI_TOKEN", "")
PORT = int(os.environ.get("NEXUS_LOCAL_AI_PORT", "18787"))
MAX_BODY = 64 * 1024
ALLOWED_MODELS = {"qwen3:14b"}


class ConcurrentAIHTTPServer(ThreadingHTTPServer):
    # Accept a burst of chat requests and let Ollama schedule them.
    request_queue_size = 512
    daemon_threads = True


class ProxyHandler(BaseHTTPRequestHandler):
    server_version = "NexusLocalAI/1.0"

    def _send(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health":
            self._send(404, {"error": "Not found"})
            return
        try:
            with urlopen("http://127.0.0.1:11434/api/tags", timeout=3) as response:
                models = json.loads(response.read()).get("models", [])
            names = {model.get("name", "") for model in models}
            missing = sorted(ALLOWED_MODELS - names)
            self._send(200 if not missing else 503, {"ok": not missing, "models": sorted(ALLOWED_MODELS - set(missing)), "missing": missing, "message": "Ready" if not missing else "The configured NEXUS model is not installed"})
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            self._send(503, {"ok": False, "message": "Ollama is not running on localhost:11434"})

    def do_POST(self) -> None:
        if self.path != "/api/chat":
            self._send(404, {"error": "Not found"})
            return
        if not ACCESS_TOKEN or self.headers.get("Authorization") != f"Bearer {ACCESS_TOKEN}":
            self._send(401, {"error": "Unauthorized"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                self._send(413, {"error": "Request size is invalid"})
                return
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict) or not isinstance(payload.get("messages"), list):
                self._send(400, {"error": "Expected a messages array"})
                return
            model = payload.get("model")
            if model not in ALLOWED_MODELS:
                self._send(400, {"error": "Unknown NEXUS model"})
                return
            safe_payload = {
                "model": model,
                "messages": payload["messages"],
                "keep_alive": "10m",
                "think": bool(payload.get("think", False)),
                "stream": False,
                "options": {"num_ctx": 2048, "num_predict": 1200, "temperature": 0.25},
            }
            request = Request(OLLAMA_URL, data=json.dumps(safe_payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(request, timeout=600) as response:
                self._send(200, json.loads(response.read()))
        except (HTTPError, URLError, TimeoutError) as exc:
            self._send(502, {"error": f"Local Ollama request failed: {exc}"})
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "Invalid JSON request"})

    def log_message(self, fmt: str, *args: object) -> None:
        # Do not log prompts, auth headers, or model responses.
        print("[nexus-local-ai] " + (fmt % args))


if __name__ == "__main__":
    if not ACCESS_TOKEN:
        raise SystemExit("NEXUS_LOCAL_AI_TOKEN must be set before starting the proxy.")
    print(f"NEXUS laptop AI proxy listening on http://127.0.0.1:{PORT}; model={','.join(sorted(ALLOWED_MODELS))}")
    ConcurrentAIHTTPServer(("127.0.0.1", PORT), ProxyHandler).serve_forever()
