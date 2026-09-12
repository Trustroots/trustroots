## Event shape

Use a parameterized-replaceable event with a stable `d` tag. The event content
should be versioned JSON containing the circle name, description, colour,
visibility, image URL, attribution, and licence metadata. Tags should contain
queryable values such as `d`, `name`, and `image`.

The exact kind is intentionally left open until it is checked against the
Nostroots event vocabulary. The implementation must verify event IDs,
signatures, timestamps, author permissions, and replacement semantics.

## Trust model

There are two distinct flows:

1. Any Nostr user may publish a proposal event.
2. The canonical Trustroots catalogue accepts only a signed event from an
   authorised curator identity, or an approved workflow that records the
   administrator's signed approval.

This keeps contribution open without allowing arbitrary relay users to rewrite
the public catalogue.

## Projection

The indexer subscribes to the configured relay, validates canonical events,
and upserts a MongoDB circle projection. The projection retains the event ID,
author pubkey, created timestamp, and previous-event reference alongside the
existing public circle fields. Public APIs continue reading the projection.

## Images

The event contains the original image reference and rights metadata. Image
processing remains a server-side concern: validate the media, cache or mirror
it where appropriate, and generate the existing 120x120, 742x496, 906x240, and
1400x900 JPG/WebP derivatives.
