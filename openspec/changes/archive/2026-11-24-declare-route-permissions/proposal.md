## Why

The in-memory ACL engine registered grants at startup and needed test seams to inspect them. A table per policy states the same permissions directly.

## What Changes

- Each module policy declares route pattern → role → HTTP methods; one shared check enforces it.
- Remove the ACL engine, startup policy registration and the `'*'` method wildcard. The offers admin grant lists get, post, put and delete.

## Capabilities

### Modified Capabilities

- `access-control`: Per-route permissions replace in-memory grants.

## Impact

Server policies in admin, contacts, experiences, messages, offers, references-thread, tribes and users, and their tests.
