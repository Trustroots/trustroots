#!/usr/bin/env python3
"""Small local API fixture for the shared member pilot simulator journey."""

import argparse
import json
import re
import secrets
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


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


class FixtureHandler(BaseHTTPRequestHandler):
    messages = [
        {
            "_id": "message-pilot-incoming",
            "content": "Hello from the test fixture.",
            "userFrom": PARTNER,
        }
    ]
    send_attempts = 0
    linked_npub = None
    nostr_challenge = None

    def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler API
        route = urlsplit(self.path).path
        if route == "/health":
            self._json(200, {"status": "ready"})
            return
        if not self._authorised():
            return
        if route == f'/api/mobile/v0/profiles/{MEMBER["username"]}':
            self._json(200, {"profile": {**MEMBER, "nostrNpub": type(self).linked_npub}})
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
        if self.path == "/api/mobile/v0/auth/signin":
            if body.get("username") != MEMBER["username"] or body.get("password") != "example-password":
                self._json(401, {"message": "Check the fixture username and password."})
                return
            self._json(200, {
                "accessToken": "fixture-access-token",
                "refreshToken": "fixture-refresh-token",
                "accessTokenExpiresAt": "2030-01-01T00:00:00Z",
                "member": MEMBER,
            })
            return
        if not self._authorised():
            return
        if self.path == "/api/mobile/v0/auth/signout":
            self._json(200, {})
        elif self.path == "/api/mobile/v0/profile/nostr/challenge":
            npub = body.get("nostrNpub")
            if not isinstance(npub, str) or not re.fullmatch(r"npub1[a-z0-9]{58}", npub):
                self._json(400, {"message": "A fixture public key is required."})
                return
            event = {
                "kind": 27235,
                "created_at": int(time.time()),
                "content": "",
                "tags": [
                    ["u", f"http://127.0.0.1:{self.server.server_port}/api/users"],
                    ["method", "PUT"],
                    ["challenge", secrets.token_hex(32)],
                ],
            }
            type(self).nostr_challenge = (npub, event)
            self._json(200, {"event": event})
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

    def do_PUT(self):  # noqa: N802 - BaseHTTPRequestHandler API
        if not self._authorised():
            return
        if self.path != "/api/mobile/v0/profile":
            self._json(404, {"message": "Fixture route not found."})
            return
        body = self._body()
        npub = body.get("nostrNpub")
        if npub != "":
            pending = type(self).nostr_challenge
            proof = body.get("nostrProof", {})
            # This fixture checks the native request shape. The server integration
            # test verifies real signatures and consumes the one-time challenge.
            if (
                pending is None
                or npub != pending[0]
                or any(proof.get(key) != value for key, value in pending[1].items())
                or not re.fullmatch(r"[a-f0-9]{128}", proof.get("sig", ""))
                or not re.fullmatch(r"[a-f0-9]{64}", proof.get("id", ""))
            ):
                self._json(400, {"message": "The fixture expects a signed profile challenge."})
                return
        type(self).nostr_challenge = None
        type(self).linked_npub = npub or None
        self._json(200, {**MEMBER, "nostrNpub": type(self).linked_npub})

    def _authorised(self):
        if self.headers.get("Authorization") == "Bearer fixture-access-token":
            return True
        self._json(401, {"code": "authentication_required", "message": "Sign in again."})
        return False

    def _body(self):
        size = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(size) or b"{}")

    def _json(self, status, value):
        data = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
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
