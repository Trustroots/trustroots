## MODIFIED Requirements

### Requirement: Administrator-curated homepage notes

Trustroots SHALL let administrators feature and remove existing public Nostr kind 1 notes. It SHALL verify a note's event ID and signature before storing it and SHALL use the original event ID to prevent duplicate entries. Featuring SHALL accept a Nostr note or event identifier, a Nostr URI, or a web link containing an event identifier. The admin lookup SHALL include the NomadWiki relay. Trustroots SHALL show featured notes under Trustroots updates for signed-in and signed-out visitors, with the publication date and the author's plain-text Trustroots NIP-05 username when available. Trustroots SHALL only show usernames eligible for public NIP-05 lookup. The homepage and admin list SHALL render inline Markdown links with absolute HTTP or HTTPS destinations. All other content SHALL be rendered as text.

#### Scenario: Administrator features a published note

- **WHEN** an administrator supplies a link for a signed kind 1 note available on a supported relay such as NomadWiki
- **THEN** Trustroots displays the note on the homepage with plain-text attribution when the author has an eligible Trustroots NIP-05 username
- **AND** featuring the same note again does not duplicate it

#### Scenario: A featured note has no public Trustroots NIP-05 username

- **WHEN** the author's key has no eligible Trustroots NIP-05 username
- **THEN** the featured note shows its publication date without an author label

#### Scenario: A featured update contains Markdown and HTML

- **WHEN** a featured note contains an inline HTTPS Markdown link, raw HTML and a Markdown link with an unsupported URL scheme
- **THEN** Trustroots renders the HTTPS link as clickable text
- **AND** displays the raw HTML and unsupported link syntax as text

#### Scenario: Administrator removes a featured note

- **WHEN** an administrator removes a note from the featured list
- **THEN** the note no longer appears on the homepage

#### Scenario: An unauthorised or invalid request is made

- **WHEN** a non-administrator requests a change, or a feature request contains an invalid signature or non-kind-1 event
- **THEN** Trustroots rejects the request and leaves the featured notes unchanged
