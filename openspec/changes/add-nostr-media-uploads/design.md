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

Trustroots stores a reference for each use of an image, including its owner,
purpose, blob hash, URL, and visibility state. A separate blob record tracks
storage and moderation state. Identical uploads can share a blob, including
uploads by different members or multiple uses by the same member.

An ordinary removal authorises the member against the affected reference and
hides only that reference immediately. It does not delete a shared blob or
hide another reference. Physical deletion is permitted only after the last
active reference is removed and the media server confirms there are no other
owners requiring retention. The selected server and adapter must support this
ownership check; if retention cannot be established, keep the blob pending
cleanup rather than issue an unconditional deletion by hash.

Reference creation and final deletion must be coordinated per blob so a new
reference cannot become active between the retention check and deletion. If
deletion has already begun, a new upload must wait for its outcome and ensure
the blob is stored before activating a reference. Failed deletion requests
remain pending for retry; retries repeat the retention check, and removed
references stay hidden.

An authorised moderation takedown is a separate, explicitly blob-wide action.
It hides all Trustroots references to the prohibited blob, blocks new uploads
of that hash, and prevents serving the blob and its derivatives through the
Trustroots-controlled media service and compatibility routes, including caches.
This serving restriction applies immediately even if physical deletion needs
a retry. The deployment must provide moderation authority separately from an
ordinary member's upload or deletion authorisation.

Nostr events and copies on external services may remain after removal or
takedown. Removing one reference does not promise that a shared public URL
becomes unavailable; a takedown applies to Trustroots-controlled serving paths.

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
