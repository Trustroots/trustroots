# Design: Nostr-compatible member media uploads

## Simple flow

1. A member selects an image in Trustroots.
2. Trustroots validates the type, size, and image contents.
3. Trustroots uploads the image to the configured Blossom server.
4. The media server returns the blob URL and SHA-256 identity.
5. Trustroots stores the URL and media metadata in its normal profile data.
6. When a Nostr event is published, it includes the media URL and an `imeta`
   tag containing MIME type, dimensions, hash, and accessibility text.

Binary data is never written into a relay event. A relay stores the signed
reference; the media server stores and serves the image.

## Storage boundary

The media server owns binary storage and derivative generation. Trustroots
owns application relationships, moderation state, and which media is shown in
its UI. The first deployment may use a persistent local volume. The storage
implementation must be replaceable without changing public media references.

## Identity and authorisation

Uploads initiated by Trustroots use the member's associated Nostr public key
when one exists. Members without a Nostr key can still upload through the
existing Trustroots account flow; Trustroots can publish a Nostr reference
only when it has an appropriate authorisation model.

The implementation must not require a member to reveal a secret key to
Trustroots. Any signing required for media-server authorisation happens in the
client or uses a Trustroots-controlled application identity, subject to the
final event design.

## Moderation and deletion

Trustroots stores a local record for every media object it uses, including the
owner, purpose, blob hash, URL, and moderation state. Removing an image from
Trustroots marks it hidden immediately and requests deletion from the media
server. A Nostr event may remain on relays, but it must no longer be served by
Trustroots.

## Compatibility

Existing avatar and circle URLs remain available during migration. The media
server can initially expose a compatibility URL shape or Trustroots can
redirect old routes to the new blob URL. Derivative sizes should be generated
or requested by the media server rather than duplicated in the application.

## Risks

- A Trustroots-operated media server is still a service dependency and needs
  backups and abuse handling.
- Public Nostr events can continue referencing media after deletion.
- External clients may not understand Trustroots-specific profile associations.
- Client-side Nostr signing may require a later, separate identity UX change.
