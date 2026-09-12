# Nostr-native circle catalogue

## Status

Proposal only. This change describes a future direction and does not alter the
current MongoDB-backed circle implementation.

## Why

The first administrator circle editor makes circle maintenance easier, but the
catalogue is still centrally stored and edited. A Nostr-native catalogue would
make circle records signed, portable, auditable, and usable by Nostroots and
other compatible clients.

## Proposal

- Represent each circle as a signed parameterized-replaceable Nostr event.
- Use a stable `d` tag for circle identity so names and URL slugs can change
  without changing the circle itself.
- Store descriptive fields, visibility, image URL, attribution, and licence
  metadata in the event.
- Let anyone publish a circle proposal, but let only authorised Trustroots or
  Nostroots curator keys publish canonical catalogue records.
- Keep a verified MongoDB projection for the existing Trustroots web
  experience, populated by a relay indexer.
- Treat edits as replacement events and retain previous event IDs for history.
- Represent removal as a signed archive/tombstone state rather than deleting
  historical events.

## Image handling

Events should reference images by URL rather than embedding binary data. The
indexer may download a referenced image, validate it, and generate the existing
responsive JPG/WebP derivatives. Image attribution and licence information
must travel with the circle record.

## Compatibility and rollout

The current MongoDB/admin API remains authoritative until the relay indexer is
available and trusted. A staged rollout can import existing circles into
signed events, compare the projection with MongoDB, and then make the signed
catalogue authoritative. Existing public circle URLs should continue to use a
stable local slug projection.

## Open decisions

- Select and document the exact event kind and tag vocabulary.
- Decide whether canonical events use one shared curator key or a set of
  authorised administrator keys.
- Define relay publication, moderation, and key-rotation rules.
- Decide whether images should use HTTPS hosting, Blossom, IPFS, or a fallback
  combination.
