## MODIFIED Requirements

### Requirement: Administrator-curated homepage notes

Trustroots SHALL let administrators feature and remove existing public Nostr kind 1 notes and NIP-23 kind 30023 articles. It SHALL verify each event ID and signature before storing it and SHALL deduplicate short notes by event ID and article revisions by address. Featuring SHALL accept a Nostr note, event or article identifier, a Nostr URI, or a web link containing one of those identifiers. The admin lookup SHALL include the NomadWiki relay. Trustroots SHALL show featured notes under Trustroots updates for signed-in and signed-out visitors, with the publication date and the author's plain-text Trustroots NIP-05 username when available. Trustroots SHALL only show usernames eligible for public NIP-05 lookup. The homepage and admin list SHALL render inline Markdown links with absolute HTTP or HTTPS destinations. All other content SHALL be rendered as text.

#### Scenario: Administrator features a published note

- **WHEN** an administrator supplies a link for a signed kind 1 note available on a supported relay such as NomadWiki
- **THEN** Trustroots displays the note on the homepage with plain-text attribution when the author has an eligible Trustroots NIP-05 username
- **AND** featuring the same note again does not duplicate it

#### Scenario: Administrator features an article by address

- **WHEN** an administrator supplies an article address available on a supported relay
- **THEN** Trustroots features the verified article at that address without duplicating a previously featured revision

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

- **WHEN** a non-administrator requests a change, or a feature request contains an invalid signature or an unsupported event kind
- **THEN** Trustroots rejects the request and leaves the featured notes unchanged

### Requirement: Publish a featured Nostr note from admin

Trustroots SHALL let administrators compose a public NIP-23 addressable update on the Nostr admin page and sign it with a NIP-07 browser signer. Trustroots SHALL verify the signature, author and requested contents before publishing it to both `wss://relay.trustroots.org` and `wss://relay.nomadwiki.org`. The page SHALL feature the signed note only after at least one destination acknowledges publication and SHALL report which destinations acknowledged it.

#### Scenario: Publish and feature an update

- **WHEN** an administrator submits a note and approves signing with their NIP-07 signer
- **AND** at least one destination acknowledges the signed event
- **THEN** Trustroots features that event on the homepage with its Nostr attribution

#### Scenario: Retry a failed homepage save

- **WHEN** at least one destination acknowledges publication but the homepage save fails
- **THEN** the page reports that the note was published and allows the administrator to retry saving the same event without signing or publishing it again

### Requirement: Request deletion of a featured Nostr note

Trustroots SHALL let an administrator request deletion of a featured note by signing a NIP-09 kind 5 event with the note's original author key. The request SHALL target the event ID and kind for a short note and the article address and kind for an addressable update. After at least one relay acknowledges publication, Trustroots SHALL verify the signed deletion request against the original author, remove the note content from its featured collection and prevent it from being featured again. The confirmation SHALL explain that relays and clients may retain copies.

#### Scenario: The note author requests deletion

- **WHEN** an administrator confirms the request, the matching signer signs it and a relay acknowledges publication
- **THEN** Trustroots removes the note from the homepage and prevents it from being featured again

#### Scenario: Deletion is not acknowledged

- **WHEN** the signer is unavailable, its key differs from the note author's key, or no relay acknowledges publication
- **THEN** the admin page reports the failure and the homepage keeps showing the note

#### Scenario: A deletion record is retried

- **WHEN** the relay accepted the deletion request and recording it on Trustroots temporarily fails
- **THEN** the administrator can retry saving the signed deletion without publishing a new request

#### Scenario: The administrator removes a note locally

- **WHEN** an administrator uses the homepage removal action
- **THEN** Trustroots removes the homepage copy and allows the note to be featured again

## ADDED Requirements

### Requirement: Edit and link featured Nostr updates

The Nostr admin page SHALL let administrators insert absolute HTTP or HTTPS links into drafts and edit featured updates signed by the connected note author. Edits SHALL publish a newer kind 30023 event at a stable address and update the existing homepage entry after at least one relay acknowledges it. Trustroots SHALL retain the original publication date and position, reject edits from a different signer and prevent stale revisions from replacing newer ones. The first edit of an immutable kind 1 note SHALL use a new addressable version tied to its original event ID.

#### Scenario: Insert a link while editing

- **WHEN** an administrator enters link text and a valid URL using Insert link
- **THEN** the composer inserts clickable link syntax at the selection and retains the rest of the draft

#### Scenario: Publish a revision

- **WHEN** the original author signs a revision and a relay acknowledges it
- **THEN** the homepage shows the revised content in the same entry with its original publication date

#### Scenario: Edit a short note

- **WHEN** the original author first edits a featured kind 1 note
- **THEN** the editor creates an addressable update and the homepage entry displays the revised content
