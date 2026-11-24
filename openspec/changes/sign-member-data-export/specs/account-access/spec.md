## MODIFIED Requirements

### Requirement: Member data export

The system SHALL let an authenticated member download a versioned JSON file
containing their profile, the circles they belong to, their contacts, their
hosting and meet offers (including expired offers still stored), and the
messages and experiences they have written. The download filename SHALL be
`trustroots-data-<username>-<yyyymmdd>-<hhmm>.json`, using the member's
username and the UTC time of the export. When the username is unsafe in a
filename, the system SHALL omit it and use
`trustroots-data-<yyyymmdd>-<hhmm>.json`.

When a usable service signing key is configured, the system SHALL sign the
export. The signed content digests SHALL depend only on the export format
and the member's data.

#### Scenario: Member downloads their data

- **WHEN** an authenticated member requests their data export
- **THEN** the system returns a JSON attachment named with that member's
  username and the UTC export time, with format `trustroots-data-export`,
  version `2`, an export timestamp, and `profile`, `circles`, `contacts`,
  `hostingOffers`, `messages`, and `experiences` sections

#### Scenario: Unauthenticated visitor requests an export

- **WHEN** an unauthenticated visitor requests the data-export endpoint
- **THEN** the system refuses the request

#### Scenario: Export is signed with the export signing key

- **WHEN** a signing key is configured and an authenticated member requests
  their data export
- **THEN** the file carries a signature with a digest per section, a root
  digest, and a valid Nostr event of the export attestation kind over the root

#### Scenario: Repeated exports of unchanged data attest the same content

- **WHEN** a member requests their data export twice without their data
  changing
- **THEN** both files carry the same section digests and the same root digest
- **AND** the request timestamp is outside the signed part of the file

#### Scenario: No signing key is configured

- **WHEN** no export signing key is configured and an authenticated member
  requests their data export
- **THEN** the system returns the export without a signature and logs a
  warning

#### Scenario: Verifier rejects a tampered file

- **WHEN** the verifier checks an export whose data has been altered after
  signing
- **THEN** it reports the altered section as mismatched and rejects the file
- **AND** it verifies the root digest against the signed section digest manifest

#### Scenario: Verifier accepts a partial export

- **WHEN** a member shares one or more sections with the original format,
  version, and signature
- **THEN** the verifier checks every supplied section, the root digest,
  attestation kind, signature, and signing key
- **AND** it reports success as a verified partial export and marks omitted
  sections as absent

#### Scenario: Verifier reports a compromised signing key

- **WHEN** the verifier checks an export signed by a key the pinned key
  history marks compromised
- **THEN** it reports the key status and that a claimed signing date before
  the compromise cannot be proven
