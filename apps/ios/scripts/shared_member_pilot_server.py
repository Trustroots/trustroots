#!/usr/bin/env python3
"""Small local API fixture for the shared member pilot simulator journey."""

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock
from urllib.parse import urlsplit
from uuid import uuid4


MEMBER = {
    "_id": "member-pilot-self",
    "username": "pilot-member",
    "displayName": "Mira Example",
    "public": True,
    "tagline": "A test profile",
    "description": "A fictional profile for simulator testing.",
    "locationLiving": "Example Bay",
}
PARTNER = {
    "_id": "member-pilot-partner",
    "username": "pilot-partner",
    "displayName": "Robin Example",
    "tagline": "A partner profile",
}
INCOMING_MESSAGE = {
    "_id": "message-pilot-incoming",
    "content": "Hello from the test fixture.",
    "userFrom": PARTNER,
}


class FixtureHandler(BaseHTTPRequestHandler):
    session_lock = Lock()
    access_token = None
    refresh_token = None
    refresh_count = 0
    messages = [INCOMING_MESSAGE]
    send_attempts = 0

    def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler API
        route = urlsplit(self.path).path
        if route == "/health":
            self._json(200, {"status": "ready"})
            return
        if not self._authorised():
            return
        if route == f'/api/mobile/v0/profiles/{MEMBER["username"]}':
            fixture = type(self)
            with fixture.session_lock:
                refresh_count = fixture.refresh_count
            profile = dict(MEMBER)
            if refresh_count:
                profile["tagline"] = f"A test profile after refresh {refresh_count}"
            self._json(200, {"profile": profile})
        elif route == f'/api/mobile/v0/profiles/{PARTNER["username"]}':
            self._json(200, {"profile": PARTNER})
        elif route == "/api/mobile/v0/messages":
            self._json(200, [{
                "_id": "thread-pilot-1",
                "message": {"excerpt": self.messages[0]["content"]},
                "read": False,
                "updated": "2026-11-15T10:00:00Z",
                "userFrom": PARTNER,
                "userTo": MEMBER,
            }])
        elif route == f'/api/mobile/v0/messages/{PARTNER["_id"]}':
            self._json(200, self.messages)
        else:
            self._json(404, {"message": "Fixture route not found."})

    def do_POST(self):  # noqa: N802 - BaseHTTPRequestHandler API
        body = self._body()
        fixture = type(self)
        if self.path in ("/fixture/expire-access-token", "/fixture/revoke-session"):
            revoke_session = self.path == "/fixture/revoke-session"
            with fixture.session_lock:
                token = fixture.refresh_token if revoke_session else fixture.access_token
                fixture.access_token = None
                if revoke_session:
                    fixture.refresh_token = None
            if token is not None:
                self._json(200, {"status": "revoked" if revoke_session else "expired"})
            else:
                self._json(409, {"message": "The fixture has no active token for this action."})
            return
        if self.path == "/api/mobile/v0/auth/signin":
            if body.get("username") != MEMBER["username"] or body.get("password") != "example-password":
                self._json(401, {"message": "Check the fixture username and password."})
                return
            with fixture.session_lock:
                fixture.messages = [INCOMING_MESSAGE]
                fixture.send_attempts = 0
                fixture.refresh_count = 0
                session = fixture._rotate_credentials()
            self._json(200, session)
            return
        if self.path == "/api/mobile/v0/auth/refresh":
            with fixture.session_lock:
                session = (
                    fixture._rotate_credentials()
                    if fixture.refresh_token and body.get("refreshToken") == fixture.refresh_token
                    else None
                )
                if session is not None:
                    fixture.refresh_count += 1
            if session is None:
                self._json(401, {"code": "authentication_required", "message": "Sign in again."})
            else:
                self._json(200, session)
            return
        if not self._authorised():
            return
        if self.path == "/api/mobile/v0/auth/signout":
            with fixture.session_lock:
                fixture.access_token = None
                fixture.refresh_token = None
            self._json(200, {})
        elif self.path == "/api/mobile/v0/messages":
            content = body.get("content")
            if body.get("userTo") != PARTNER["_id"] or not isinstance(content, str) or not content.strip():
                self._json(422, {"message": "The fixture expects a reply to the configured partner."})
                return
            type(self).send_attempts += 1
            if type(self).send_attempts == 1:
                self._json(503, {"message": "Temporary fixture delivery failure."})
                return
            message = {
                "_id": f"message-pilot-reply-{type(self).send_attempts}",
                "content": content,
                "userFrom": MEMBER,
            }
            type(self).messages.insert(0, message)
            self._json(201, message)
        else:
            self._json(404, {"message": "Fixture route not found."})

    def _authorised(self):
        fixture = type(self)
        with fixture.session_lock:
            token = fixture.access_token
        if token and self.headers.get("Authorization") == f"Bearer {token}":
            return True
        self._json(401, {"code": "authentication_required", "message": "Sign in again."})
        return False

    @classmethod
    def _rotate_credentials(cls):
        cls.access_token = f"fixture-access-{uuid4()}"
        cls.refresh_token = f"fixture-refresh-{uuid4()}"
        return {
            "accessToken": cls.access_token,
            "refreshToken": cls.refresh_token,
            "accessTokenExpiresAt": "2030-01-01T00:00:00Z",
            "member": MEMBER,
        }

    def _body(self):
        size = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(size) or b"{}")

    def _json(self, status, value):
        data = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), FixtureHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
