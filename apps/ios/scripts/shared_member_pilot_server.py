#!/usr/bin/env python3
"""Small local API fixture for the shared member pilot simulator journey."""

import argparse
import json
import re
import secrets
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock
from urllib.parse import parse_qs, urlsplit
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
    "description": "<p>I enjoy exploring on foot, finding local cafés and swapping book recommendations with fellow travellers.</p>",
    "languages": ["eng", "fra"],
    "replyRate": "87%",
    "replyTime": "2 days",
    "locationLiving": "Example Harbour",
}
VOLUNTEER_OFFER_ID = "offer-pilot-volunteer"
OTHER_OFFER_ID = "offer-pilot-other"
CIRCLES = [
    {
        "_id": "circle-pilot-night",
        "slug": "night-walkers",
        "label": "Night Walkers",
        "description": "<p>Bring a lantern.</p>",
        "count": 42,
    },
    {
        "_id": "circle-pilot-garden",
        "slug": "garden-friends",
        "label": "Garden Friends",
        "description": "<p>Share seeds.</p>",
        "count": 18,
    },
]
CIRCLE_ROUTE = "/api/mobile/v0/memberships/"
INCOMING_MESSAGE = {
    "_id": "message-pilot-incoming",
    "content": "Hello from the test fixture.",
    "userFrom": PARTNER,
}
EARLIER_MESSAGE = {
    "_id": "message-pilot-earlier",
    "content": "I left the lantern by the door.",
    "userFrom": PARTNER,
}

HOSTING_OFFER = {
    "_id": "offer-pilot-host",
    "type": "host",
    "status": "no",
    "meetingStatus": "yes",
    "volunteering": True,
    "maxGuests": 0,
    "description": "<p>Fictional offer details.</p>",
    "noOfferDescription": "<p>Travelling this month.</p>",
    "showOnlyInMyCircles": True,
    "location": [41.1, -8.5],
}


class FixtureHandler(BaseHTTPRequestHandler):
    session_lock = Lock()
    access_token = None
    refresh_token = None
    refresh_count = 0
    drop_profile_response = False
    messages = [INCOMING_MESSAGE, EARLIER_MESSAGE]
    thread_read = False
    send_attempts = 0
    linked_npub = None
    nostr_challenge = None
    hosting_offer = None
    memberships = {CIRCLES[1]["_id"]}

    def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler API
        request = urlsplit(self.path)
        route = request.path
        if route == "/health":
            self._json(200, {"status": "ready"})
            return
        if route == "/fixture/inbox-read-state":
            fixture = type(self)
            with fixture.session_lock:
                thread_read = fixture.thread_read
            self._json(200, {"read": thread_read})
            return
        if route == "/api/nostr/featured-notes":
            self._json(200, [{
                "id": "fixture-update",
                "content": "A fictional Trustroots update.",
                "authorUsername": "fixture-news",
                "publishedAt": "2026-11-15T10:00:00Z",
            }])
            return
        if route == "/fixture/hosting-offer":
            with type(self).session_lock:
                offer = type(self).hosting_offer
            self._json(200, offer)
            return
        if not self._authorised():
            return
        if route == "/api/mobile/v0/me":
            self._json(200, {"member": {
                **MEMBER,
                "email": "pilot-member@example.test",
                "newsletter": False,
            }})
        elif route == f'/api/mobile/v0/profiles/{MEMBER["username"]}':
            fixture = type(self)
            with fixture.session_lock:
                drop_profile_response = fixture.drop_profile_response
                refresh_count = fixture.refresh_count
                linked_npub = fixture.linked_npub
            if drop_profile_response:
                self.close_connection = True
                return
            profile = {**MEMBER, "nostrNpub": linked_npub}
            if refresh_count:
                profile["tagline"] = f"A test profile after refresh {refresh_count}"
            self._json(200, {"profile": profile})
        elif route == f'/api/mobile/v0/profiles/{PARTNER["username"]}':
            self._json(200, {"profile": PARTNER})
        elif route == "/api/mobile/v0/members":
            params = parse_qs(urlsplit(self.path).query)
            matches = params.get("connectionsOnly") == ["true"] and params.get("search") == ["partner profile"]
            self._json(200, [PARTNER] if matches else [])
        elif route == f'/api/mobile/v0/offers-by/{MEMBER["_id"]}':
            with type(self).session_lock:
                offer = type(self).hosting_offer
            self._json(200, [offer if offer is not None else {
                "_id": "offer-pilot-self",
                "status": "no",
                "meetingStatus": "maybe",
                "volunteering": True,
            }])
        elif route == f'/api/mobile/v0/contacts/{MEMBER["_id"]}':
            self._json(200, [{
                "_id": "contact-pilot-one",
                "confirmed": False,
                "user": PARTNER,
            }])
        elif route == "/api/mobile/v0/connections":
            self._json(200, {
                "recent": [dict(PARTNER, activity="today")],
                "hosts": [dict(PARTNER, location=[41.15, -8.61])],
                "meetings": [],
            })
        elif route == "/api/mobile/v0/offers":
            filters = json.loads(parse_qs(urlsplit(self.path).query).get("filters", ["{}"])[0])
            ids = []
            if "host" in filters.get("types", ["host"]):
                ids.append(VOLUNTEER_OFFER_ID)
                if not filters.get("volunteering") and not filters.get("connectionsOnly"):
                    ids.append(OTHER_OFFER_ID)
            self._json(200, {"features": [{
                "properties": {"id": offer_id, "type": "host", "status": "yes"},
                "geometry": {"coordinates": [-9.14, 38.72]},
            } for offer_id in ids]})
        elif route in (f"/api/mobile/v0/offers/{VOLUNTEER_OFFER_ID}", f"/api/mobile/v0/offers/{OTHER_OFFER_ID}"):
            self._json(200, {
                "_id": route.rsplit("/", 1)[1],
                "type": "host",
                "status": "yes",
                "description": "A fictional hosting offer.",
                "meetingStatus": "maybe",
                "volunteering": route.endswith(VOLUNTEER_OFFER_ID),
                "user": PARTNER,
            })
        elif route == "/api/mobile/v0/circles":
            self._json(200, CIRCLES)
        elif route == "/api/mobile/v0/memberships":
            fixture = type(self)
            with fixture.session_lock:
                memberships = [{"tribe": circle} for circle in CIRCLES if circle["_id"] in fixture.memberships]
            self._json(200, memberships)
        elif route == "/api/mobile/v0/experiences":
            self._json(200, [])
        elif route == "/api/mobile/v0/messages":
            fixture = type(self)
            with fixture.session_lock:
                excerpt = fixture.messages[0]["content"]
                thread_read = fixture.thread_read
            self._json(200, [{
                "_id": "thread-pilot-1",
                "message": {"excerpt": excerpt},
                "read": thread_read,
                "updated": "2026-11-15T10:00:00Z",
                "userFrom": PARTNER,
                "userTo": MEMBER,
            }])
        elif route == f'/api/mobile/v0/messages/{PARTNER["_id"]}':
            fixture = type(self)
            # Lose the conversation connection after the first rejected reply.
            # The pilot must read its saved copy until the member retries.
            if self.send_attempts == 1:
                self.log_message("Dropping the conversation connection for the draft recovery test.")
                self.close_connection = True
                return
            with fixture.session_lock:
                if parse_qs(request.query).get("markRead") != ["false"]:
                    fixture.thread_read = True
                messages = list(fixture.messages)
            self._json(200, messages)
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
        if self.path == "/fixture/prepare-hosting-offer":
            with fixture.session_lock:
                fixture.hosting_offer = HOSTING_OFFER
            self._json(200, {"status": "ready"})
            return
        if self.path == "/api/mobile/v0/auth/signin":
            if body.get("username") != MEMBER["username"] or body.get("password") != "example-password":
                self._json(401, {"message": "Check the fixture username and password."})
                return
            with fixture.session_lock:
                fixture.messages = [INCOMING_MESSAGE, EARLIER_MESSAGE]
                fixture.thread_read = False
                fixture.send_attempts = 0
                fixture.refresh_count = 0
                fixture.hosting_offer = None
                fixture.memberships = {CIRCLES[1]["_id"]}
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
        elif self.path == CIRCLE_ROUTE + CIRCLES[0]["_id"]:
            with fixture.session_lock:
                fixture.memberships.add(CIRCLES[0]["_id"])
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
        elif self.path == "/api/mobile/v0/messages-read":
            message_ids = body.get("messageIds")
            if not isinstance(message_ids, list):
                self._json(400, {"message": "Expected fixture message identifiers."})
                return
            with fixture.session_lock:
                if INCOMING_MESSAGE["_id"] in message_ids:
                    fixture.thread_read = True
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

    def do_PUT(self):  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path == "/fixture/profile-connection":
            drop = self._body().get("drop")
            if not isinstance(drop, bool):
                self._json(400, {"message": "Expected a boolean drop value."})
                return
            fixture = type(self)
            with fixture.session_lock:
                fixture.drop_profile_response = drop
            self._json(200, {"drop": drop})
            return
        if not self._authorised():
            return
        if self.path == f'/api/mobile/v0/offers/{HOSTING_OFFER["_id"]}':
            update = self._body()
            fixture = type(self)
            with fixture.session_lock:
                fixture.hosting_offer = {**update, "_id": HOSTING_OFFER["_id"]}
            self._json(200, {"message": "Offer updated."})
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

    def do_DELETE(self):  # noqa: N802 - BaseHTTPRequestHandler API
        if not self._authorised():
            return
        if self.path == CIRCLE_ROUTE + CIRCLES[0]["_id"]:
            fixture = type(self)
            with fixture.session_lock:
                fixture.memberships.discard(CIRCLES[0]["_id"])
            self._json(200, {})
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
