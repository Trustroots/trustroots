## MODIFIED Requirements

### Requirement: Member data export

The system SHALL let an authenticated member download a signed, versioned
JSON file containing their profile, contacts, and hosting offers, and the
signed part of that file SHALL depend only on the member's data.

#### Scenario: Member downloads their data

- **WHEN** an authenticated member requests their data export
- **THEN** the system returns a JSON attachment with format
  `trustroots-data-export`, version `2`, an export timestamp, and `profile`,
  `contacts`, and `hostingOffers` sections

#### Scenario: Unauthenticated visitor requests an export

- **WHEN** an unauthenticated visitor requests the data-export endpoint
- **THEN** the system refuses the request

#### Scenario: Export is signed with the export signing key

- **WHEN** a signing key is configured and an authenticated member requests
  their data export
- **THEN** the file carries a signature with a digest per section, a root
  digest, and a valid Nostr attestation event over the root

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
- **THEN** it reports the altered section and the root digest as mismatched
  and does not report the file as valid

#### Scenario: Verifier reports a compromised signing key

- **WHEN** the verifier checks an export signed by a key the pinned key
  history marks compromised
- **THEN** it reports the key status and that a claimed signing date before
  the compromise cannot be proven
