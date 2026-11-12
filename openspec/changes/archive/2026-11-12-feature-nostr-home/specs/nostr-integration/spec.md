## ADDED Requirements

### Requirement: Administrator-curated homepage notes

Trustroots SHALL let administrators feature and remove existing public Nostr kind 1 notes. It SHALL verify a note's event ID and signature before storing it and SHALL use the original event ID to prevent duplicate entries. Featuring SHALL accept a Nostr note or event identifier, a Nostr URI, or a web link containing an event identifier. Trustroots SHALL render the featured note as text on the homepage for signed-in and signed-out visitors, with its original author, publication date and a link to the original note.

#### Scenario: Administrator features a published note

- **WHEN** an administrator supplies a link for an available signed kind 1 note
- **THEN** Trustroots displays the note on the homepage with attribution to its Nostr author
- **AND** featuring the same note again does not duplicate it

#### Scenario: Administrator removes a featured note

- **WHEN** an administrator removes a note from the featured list
- **THEN** the note no longer appears on the homepage

#### Scenario: An unauthorised or invalid request is made

- **WHEN** a non-administrator requests a change, or a feature request contains an invalid signature or non-kind-1 event
- **THEN** Trustroots rejects the request and leaves the featured notes unchanged
