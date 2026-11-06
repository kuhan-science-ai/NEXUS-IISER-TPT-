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


class ConcurrentAIHTTPServer(ThreadingHTTPServer):
    # Accept a burst of chat requests and let Ollama schedule them in arrival
    # order. Ollama runs up to 15 requests concurrently and queues the rest.
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
            ready = any(model.get("name", "").split(":")[0] == "gpt-oss" and model.get("name", "").startswith("gpt-oss:20b") for model in models)
            self._send(200 if ready else 503, {"ok": ready, "model": "gpt-oss:20b", "message": "Ready" if ready else "Run: ollama pull gpt-oss:20b"})
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
            safe_payload = {
                "model": "gpt-oss:20b",
                "messages": payload["messages"],
                # Keep the model warm between requests; loading a 20B model is
                # much slower than generating short follow-up responses.
                "keep_alive": "24h",
                # GPT-OSS can spend time producing a long reasoning trace.
                # Disable it for quicker conversational answers and keep the
                # context/output budget bounded for the laptop GPU.
                "think": False,
                "stream": False,
                "options": {"num_ctx": 2048, "num_predict": 1024, "temperature": 0.3},
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
    print(f"NEXUS laptop AI proxy listening on http://127.0.0.1:{PORT}; model=gpt-oss:20b")
    ConcurrentAIHTTPServer(("127.0.0.1", PORT), ProxyHandler).serve_forever()
