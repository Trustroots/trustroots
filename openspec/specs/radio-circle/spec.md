# radio-circle Specification

## Purpose

TBD - created by archiving change add-radio-circle. Update Purpose after archive.

## Requirements

### Requirement: Public radio playback

The Radio circle SHALL provide the existing Radiostr station catalogue, grouped
stations, local favourites, station hash links and user-initiated audio playback.
Playback SHALL stop when leaving the circle. Playback failures SHALL be visible
and SHALL NOT prevent choosing another station.

#### Scenario: A visitor listens

- **WHEN** a logged-out visitor opens the Radio circle and selects a station
- **THEN** they can play, pause and favourite it, and see the shared listener count
- **AND** chat and listener identities are hidden

### Requirement: Authenticated social interface

Chat and listener identities SHALL be shown only to logged-in Trustroots
members. The interface SHALL NOT subscribe to chat, fetch listener profiles, or
look up author identities for visitors. These restrictions SHALL NOT claim that
public Nostr events are private.

#### Scenario: A member reads the room

- **WHEN** a logged-in member opens the circle without a signer
- **THEN** they can read chat and see listeners but cannot publish

#### Scenario: A visitor opens the room

- **WHEN** a visitor opens Radio
- **THEN** the interface does not request personalised author identity data

### Requirement: Matching verified signing identity

Publication SHALL require a Nostr signer matching both the logged-in member's linked npub and the member's Trustroots NIP-05 lookup. The Radio circle SHALL detect a complete NIP-07 provider on entry and for up to five seconds and attempt connection once for a member with a linked npub. Manual retry SHALL remain available. The application SHALL store no secret keys and SHALL verify signed event contents.

#### Scenario: A mismatched signer connects

- **WHEN** the extension key differs from the member's linked key or NIP-05 lookup
- **THEN** publishing is disabled and the mismatch is explained

#### Scenario: A matching extension is available

- **WHEN** a logged-in member with a linked npub opens Radio with a matching NIP-07 extension
- **THEN** Radio connects the signer automatically
- **AND** uses the signer for chat, favourites and listening activity

### Requirement: Radiostr compatibility

Chat, favourites and listening events SHALL use the existing kind-1 Radiostr tags,
station IDs, thirty-day expiration, and Trustroots/Nomadwiki relays. Listener
counts SHALL deduplicate public keys and expire activity after twelve minutes.
Verified connected members SHALL share activity after ten seconds of playback,
then every five minutes while playing. Favourites SHALL reconcile local state
with that signer's relay events, preserving remote unstar actions.

#### Scenario: Both interfaces are in use

- **WHEN** Radiostr publishes a supported room event
- **THEN** the circle processes it using the same station and room identities
- **AND** duplicate relay deliveries do not duplicate messages or listeners

### Requirement: Chat message details

Radio chat SHALL show an author's eligible public Trustroots NIP-05 label and
link it to the author's Trustroots profile. The profile link's native `title`
attribute SHALL contain the author's full npub. When no eligible public
Trustroots NIP-05 identity is available, chat SHALL show the full npub as plain
text without a profile link. Each message SHALL display its timestamp in UTC as
yyyy-mm-dd hh:mm. Station hashtags SHALL link to the matching station fragment
on the Radio circle URL.

#### Scenario: A member reads a station message

- **WHEN** a member reads a message tagged with a known station
- **THEN** they see the author's NIP-05 label when eligible, otherwise the full
  npub, and the timestamp in UTC
- **AND** the station hashtag links to the Radio circle with that station selected

#### Scenario: A message author has an eligible public profile

- **WHEN** the author's key is linked to a confirmed, public Trustroots account
  with an eligible NIP-05 identity and without a suspension or shadowban
- **THEN** the NIP-05 label links to that account's Trustroots profile
- **AND** the link's native `title` attribute contains the full npub

#### Scenario: A message author has no eligible public identity

- **WHEN** the author's key has no eligible public Trustroots NIP-05 identity
- **THEN** the full npub is shown as plain text without a profile link

### Requirement: Immediate local listening contribution

Radio SHALL count local playback immediately for signed-in and anonymous listeners, label the local contribution, and deduplicate it against shared activity when the linked public key is known. The local contribution SHALL end when playback stops or fails. The shared listener list SHALL continue to reflect relay activity.

#### Scenario: Playback starts before a shared announcement

- **WHEN** a listener starts playback without an active shared event for their key
- **THEN** their browser counts them immediately and labels the local contribution
- **AND** a subsequent shared event for the linked key is counted once

### Requirement: Radio listening identity labels

The signed-in Radio Listening now list SHALL show an eligible public Trustroots
NIP-05 label for each listener and link it to that member's Trustroots profile.
The profile link's native `title` attribute SHALL contain the listener's full
npub. When no eligible public Trustroots NIP-05 identity is available, the list
SHALL show the full npub as plain text. Visitors SHALL NOT trigger listener
identity lookups.

#### Scenario: A listener has an eligible public profile

- **WHEN** a signed-in member views Listening now and a listener has an eligible
  public Trustroots NIP-05 identity
- **THEN** the listener's NIP-05 label links to their profile with the full npub
  in the native `title` attribute

#### Scenario: A listener has no eligible public identity

- **WHEN** a listener has no eligible public Trustroots NIP-05 identity
- **THEN** their full npub is shown as plain text

### Requirement: Official station artwork in catalogue rows

Radio station rows SHALL show official station artwork when it is available in
the curated station catalogue metadata. Artwork URLs in that metadata SHALL use
HTTPS and come from official broadcaster or station sources. The artwork
SHALL link to the broadcaster's website separately from the play control.
Station rows SHALL show initials derived from
the station title when artwork metadata is absent or the image fails to load.
This SHALL apply to station rows shown in catalogue groups and favourites.
Artwork SHALL NOT change station identifiers, stream URLs, or playback
behaviour.

#### Scenario: A station has curated official artwork

- **WHEN** a station row has an HTTPS artwork URL in the curated catalogue
- **THEN** the row displays that station artwork as a link to the broadcaster's
  website

#### Scenario: Artwork is absent or fails to load

- **WHEN** a station has no artwork URL or its artwork image fails to load
- **THEN** the row displays initials derived from the station title
- **AND** the station remains available for playback and favouriting

#### Scenario: A station appears in favourites

- **WHEN** a station with artwork or a fallback appears in the favourites list
- **THEN** its row uses the same artwork and fallback behaviour as catalogue
  rows
