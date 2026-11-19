## Context

Featured homepage notes are signed Nostr events. Kind 1 identifies an immutable short note. NIP-23 and NIP-01 define addressable articles whose author can replace their content at the same address.

## Goals / Non-Goals

- Support author-signed edits and link insertion from the existing admin page.
- Keep the public selection and ordering stable across revisions.
- Leave replication and retention of older events to relays.

## Decisions

- New publications use kind 30023 with a stable `d` identifier and original `published_at`. Editing a featured kind 1 note uses that note's original event ID as the address identifier.
- Store one homepage row per featured note. Pin the original author and check signed, newer revisions against the current row. Deletion requests address the current article using NIP-09.
- Insert inline Markdown from separate label and web URL inputs. Keep the existing plain-text rendering policy for other content.

## Risks / Trade-offs

- Short-note clients may omit NIP-23 updates. The original signed kind 1 event remains on relays after the first revision.
- Relay acknowledgment and the Trustroots write are separate operations. Retry the same signed event after a partial failure.
