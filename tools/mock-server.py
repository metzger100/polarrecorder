#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from mock_server.handlers import dispatch
from mock_server.state import MockError

ROOT = Path(__file__).resolve().parents[1]
PORT = 8080


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.serve_api(parsed.path, parse_qs(parsed.query, keep_blank_values=True))
            return
        self.serve_static(parsed.path)

    def serve_api(self, path: str, query: dict[str, list[str]]) -> None:
        endpoint = path.removeprefix("/api/").strip("/")
        try:
            body = dispatch(endpoint, query)
        except MockError as exc:
            self.send_json({"status": "ERROR", "error": str(exc)})
            return
        if body is None:
            self.send_error(404)
            return
        self.send_json(body)

    def serve_static(self, raw_path: str) -> None:
        path = unquote(raw_path).lstrip("/") or "viewer/viewer.html"
        target = (ROOT / path).resolve()
        if not str(target).startswith(str(ROOT)) or not target.is_file():
            self.send_error(404)
            return
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_file(target, content_type)

    def send_json(self, body: dict[str, object]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_file(self, path: Path, content_type: str) -> None:
        payload = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Serving Polar Recorder mock UI at http://localhost:{PORT}/viewer/viewer.html")
    server.serve_forever()


if __name__ == "__main__":
    main()
