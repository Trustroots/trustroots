# Nostr-compatible member media uploads

## Status

Proposal only. This change does not alter the current upload implementation.

## Why

Trustroots currently stores uploaded avatars and circle images in the
application's public directory. That makes increasing the number of member
uploads harder, and the files are not naturally portable to Nostroots or other
Nostr clients.

Nostr events should describe and reference media, not carry binary files or
depend on a particular application deployment. Trustroots needs a small,
controlled media service that can support ordinary uploads today and
Nostr-compatible sharing later.

## Proposal

- Run one Trustroots-controlled Blossom-compatible media server.
- Store uploaded member media as content-addressed blobs.
- Keep the media server's storage persistent and independent of application
  releases.
- Publish uploaded media in Nostr events as URLs with `imeta` metadata.
- Use the same media service for avatars and future profile/travel photos.
- Keep the existing Trustroots upload flow working while the Nostr path is
  introduced incrementally.
- Allow Trustroots to moderate and remove media hosted by its own server.

## Scope

The first implementation should support images only, with the existing upload
size and validation rules retained. It should provide a simple upload,
retrieve, and delete path, plus stable URLs that can later be used by
Nostroots and other Nostr clients.

## Non-goals

- Building a new relay or peer-to-peer storage network.
- Requiring members to understand Nostr keys or media servers.
- Supporting arbitrary large files, video, or private attachments initially.
- Migrating every existing image before the new upload path is proven.
- Making Nostr the authoritative source for Trustroots member profiles in this
  change.

## Compatibility and rollout

The existing MongoDB-backed Trustroots experience remains authoritative during
rollout. Existing image URLs continue to work. New uploads may be stored by
the media server while Trustroots retains the relevant media URL and metadata.

The deployment must provide persistent media storage, backups, upload limits,
and a moderation/deletion procedure. Application releases must not delete
uploaded media.

## Open decisions

- Select the Blossom-compatible server implementation and deployment location.
- Decide whether the first media URLs use a dedicated hostname or a reverse
  proxy under the Trustroots hostname.
- Decide which Nostr event kind represents a profile/travel photo and how it is
  associated with a Trustroots profile.
- Define retention, reporting, and abuse-response rules for member uploads.
