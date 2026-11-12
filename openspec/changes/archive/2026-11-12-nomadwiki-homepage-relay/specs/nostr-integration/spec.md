## MODIFIED Requirements

### Requirement: Administrator-curated homepage notes

Trustroots SHALL let administrators feature and remove existing public Nostr kind 1 notes. It SHALL verify a note's event ID and signature before storing it and SHALL use the original event ID to prevent duplicate entries. Featuring SHALL accept a Nostr note or event identifier, a Nostr URI, or a web link containing an event identifier. The admin lookup SHALL include the NomadWiki relay. Trustroots SHALL show featured notes under Trustroots updates for signed-in and signed-out visitors, with the publication date and a link to the author's Nostr profile. The homepage and admin list SHALL render inline Markdown links with absolute HTTP or HTTPS destinations. All other content SHALL be rendered as text.

#### Scenario: Administrator features a published note

- **WHEN** an administrator supplies a link for a signed kind 1 note available on a supported relay such as NomadWiki
- **THEN** Trustroots displays the note on the homepage with attribution to its Nostr author
- **AND** featuring the same note again does not duplicate it

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

### Requirement: Publish a featured Nostr note from admin

Trustroots SHALL let administrators compose a public Nostr kind 1 text note on the Nostr admin page and sign it with a NIP-07 browser signer. Trustroots SHALL verify the signature, author and requested contents before publishing it to both `wss://relay.trustroots.org` and `wss://relay.nomadwiki.org`. The page SHALL feature the signed note only after at least one destination acknowledges publication and SHALL report which destinations acknowledged it.

#### Scenario: Publish and feature an update

- **WHEN** an administrator submits a note and approves signing with their NIP-07 signer
- **AND** at least one destination acknowledges the signed event
- **THEN** Trustroots features that event on the homepage with its Nostr attribution

#### Scenario: Retry a failed homepage save

- **WHEN** at least one destination acknowledges publication but the homepage save fails
- **THEN** the page reports that the note was published and allows the administrator to retry saving the same event without signing or publishing it again
