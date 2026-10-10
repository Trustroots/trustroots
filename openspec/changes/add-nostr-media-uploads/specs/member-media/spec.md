## ADDED Requirements

### Requirement: Validated image uploads

The system SHALL accept image uploads through authorised Trustroots account
flows without requiring a Nostr key. It SHALL retain existing upload size,
MIME type, image-content validation, and derivative behaviour. It SHALL make a
new media reference active only after its image is successfully stored.

#### Scenario: Member uploads a supported image without a Nostr key

- **WHEN** an authenticated member without a Nostr key submits a valid image
- **THEN** the image is stored and displayed for the authorised purpose

#### Scenario: Upload is invalid or storage fails

- **WHEN** an upload fails validation or cannot be stored
- **THEN** the system explains the failure and retains the previous image
- **AND** no reference to an unavailable new blob becomes active

### Requirement: Persistent media storage and compatible URLs

The system SHALL store new media on a Trustroots-controlled Blossom-compatible
service with content-addressed blobs, persistent storage independent of
application releases, and documented backup and restoration procedures. It
SHALL preserve existing avatar and circle URLs and derivative behaviour during
rollout and retain stable public media references when storage is replaced.

#### Scenario: Application release or storage replacement

- **WHEN** the application is redeployed or the underlying storage is replaced
- **THEN** retained images remain available through their existing public URLs

#### Scenario: Existing image is accessed during rollout

- **WHEN** a client requests an existing avatar or circle image URL
- **THEN** the image remains available with its existing derivative behaviour

### Requirement: Nostr-compatible media references

When publishing a supported media-sharing event, the system SHALL include the
media URL and an `imeta` tag with MIME type, dimensions, hash, and accessibility
text, without embedding binary image data. Publication SHALL require an
appropriate authorisation model and SHALL NOT require disclosure of a member's
secret key to Trustroots. Event kind and profile association SHALL be agreed
before enabling publication.

#### Scenario: Authorised media publication

- **WHEN** an authorised media-sharing event is published
- **THEN** it includes the stored image URL and metadata without binary data
- **AND** signing uses client authorisation or an authorised application identity

#### Scenario: Publication authorisation is unavailable

- **WHEN** an image is uploaded without an appropriate publication authorisation
- **THEN** the Trustroots upload remains usable without publishing a Nostr event

### Requirement: Independent references to shared blobs

The system SHALL track ownership, purpose, and visibility per media reference,
separately from blob storage and moderation state. Ordinary removal SHALL
require authorisation for the affected reference and SHALL immediately hide
only that reference. It SHALL retain blobs needed by other active references
or other owners on the media service.

#### Scenario: Two members upload identical images

- **WHEN** one member removes their reference to a blob used by another member
- **THEN** only the removing member's reference is hidden
- **AND** the other member's image and the shared blob remain available

#### Scenario: One member uses a blob for multiple purposes

- **WHEN** the member removes one of their references to the shared blob
- **THEN** their other active references continue to display the image

#### Scenario: Member attempts to remove another member's reference

- **WHEN** a member requests removal without authority over the reference
- **THEN** the request is rejected without changing any reference or blob

### Requirement: Safe physical deletion and retries

The system SHALL request ordinary physical deletion only when no active
references or other media-service owners require the blob. If ownership cannot
be established, it SHALL defer deletion. Reference creation and final deletion
SHALL be coordinated per blob to prevent activation of a reference to a blob
being deleted. Failed deletion SHALL remain pending for retry, with retention
checked again on each attempt and removed references remaining hidden.

#### Scenario: Last reference is removed

- **WHEN** the last active reference is removed and no other owner needs the blob
- **THEN** the system requests physical deletion of the unused blob

#### Scenario: Media service has another owner or ownership is unknown

- **WHEN** local references are removed but another owner needs the blob or the
  media service cannot confirm retention status
- **THEN** the system retains the blob instead of unconditionally deleting by hash

#### Scenario: Upload races with final deletion

- **WHEN** a new upload references a blob whose final deletion is pending or running
- **THEN** deletion is cancelled or the upload waits for deletion to finish
- **AND** the new reference becomes active only after the blob is available

#### Scenario: A deletion retry encounters a new reference

- **WHEN** a failed deletion is retried after a new reference became active
- **THEN** the system retains the blob and the new reference remains usable
- **AND** previously removed references stay hidden

### Requirement: Blob-wide moderation takedowns

The system SHALL provide a separately authorised moderation action that hides
all references to a prohibited blob, blocks new uploads of its hash, and
immediately prevents serving it and its derivatives through Trustroots-controlled
media, compatibility routes, and caches. This restriction SHALL remain in effect
if physical deletion fails. The system SHALL NOT promise removal of Nostr events
or copies hosted outside Trustroots control.

#### Scenario: Moderator takes down a shared blob

- **WHEN** an authorised moderator takes down a blob used by multiple members
- **THEN** all its Trustroots references are hidden and its hash cannot be uploaded
- **AND** its media URLs, derivatives, compatibility routes, and cached copies
  cannot serve the image through Trustroots-controlled services

#### Scenario: Physical deletion fails during a takedown

- **WHEN** physical deletion of a prohibited blob fails
- **THEN** serving remains blocked while physical deletion is retried

#### Scenario: Ordinary member attempts a blob-wide takedown

- **WHEN** a member without moderation authority requests a blob-wide takedown
- **THEN** the request is rejected and other members' references remain unchanged
