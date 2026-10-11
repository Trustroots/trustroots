## Why

Members need to check how a formatted message will look before sending it, without losing their draft.

## What Changes

- Add an optional Preview / Edit toggle to opening-message and reply composers on desktop and mobile.
- Format drafts through an authenticated, side-effect-free `POST /api/messages-preview` endpoint using the existing text service.
- Reuse outgoing message presentation and link handling, preserve drafts across toggles, and keep Send available in both views.

## Impact

- Affects messaging server routes, permissions, client composer, message rendering and tests.
- No database migration or existing API changes. Deploy the new endpoint before or with the client.
