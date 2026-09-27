# Experiences and References Specification

## Purpose

Let members share and view experiences with other members, and manage the
related reference-thread history.

## Requirements

### Requirement: Experience creation

The system SHALL let a member create a valid public or private experience for
another member where the experience feature is available.

#### Scenario: Member submits a valid experience

- **WHEN** a member submits a valid experience for another member
- **THEN** the system saves the experience with the selected visibility

#### Scenario: Member attempts to create an experience about themselves

- **WHEN** a member attempts to create an experience about themselves
- **THEN** the system rejects the request

### Requirement: Experience visibility and detail

The system SHALL display experience counts and details according to the
experience visibility rules.

#### Scenario: Member views a public experience

- **WHEN** a member opens a profile with a public experience
- **THEN** the profile displays the experience and its relevant details

#### Scenario: Member views an experience with restricted visibility

- **WHEN** a member is not permitted to view an experience
- **THEN** the system does not expose that experience's protected details

### Requirement: Duplicate experience prevention

The system SHALL identify an existing experience between the same members and
prevent a duplicate experience from being created.

#### Scenario: Member opens an experience form for an existing relationship

- **WHEN** a member opens an experience form where an experience already exists
- **THEN** the system displays the already-shared state instead of a duplicate form

### Requirement: Reference-thread access

The system SHALL provide the supported reference-thread APIs when the
reference feature is enabled, and SHALL leave them unavailable when it is
disabled.

#### Scenario: Client creates and reads a reference thread

- **WHEN** an eligible client uses the supported reference-thread API while the feature is enabled
- **THEN** the system creates and returns the reference-thread data

#### Scenario: Reference feature is disabled

- **WHEN** a client requests a reference-thread route while the feature is disabled
- **THEN** the system reports that the route is unavailable

### Requirement: Public experience statistics

The system SHALL provide aggregate statistics for all Experiences, including
all-time and preceding-90-day totals and the number of experiences whose
author recommends or does not recommend the member described, and the number
of unique member pairs that record a real-life meeting. The system SHALL also
provide all-time and preceding-90-day counts of message conversations whose
first message received a reply, and the positive rate of the latest available
message feedback for replied member pairs. The aggregates SHALL exclude
individual Experience content, message content, member identities, and
visibility status. Experiences without a recommendation and replied threads
without message feedback SHALL be excluded from their respective percentage
denominators.

#### Scenario: Visitor receives public experience statistics

- **WHEN** a visitor requests the public statistics data
- **THEN** the response includes all-time and preceding-90-day counts of public and private Experiences
- **AND** includes the corresponding counts with a recommendation and a non-recommendation
- **AND** includes the corresponding counts where members met in person
- **AND** includes all-time and preceding-90-day counts of conversations whose first message received a reply
- **AND** includes positive and negative latest-feedback counts for replied member pairs
- **AND** includes no individual Experience content, message content, member identity, or visibility-status data

### Requirement: Admin-issued Experience change links

The system SHALL let an administrator issue a seven-day link for one Experience
and one of its members. Issuing a replacement link for that member and
Experience SHALL invalidate the earlier link. A link SHALL require both the
secret and the matching signed-in member to submit a request.

#### Scenario: Author opens a valid link

- **WHEN** an Experience author opens their unexpired link while signed in
- **THEN** they can propose an edit or request removal

#### Scenario: Recipient opens a valid link

- **WHEN** the recipient opens their unexpired link while signed in
- **THEN** they can request removal but cannot edit the author's Experience

#### Scenario: Link is expired, replaced, or used by another account

- **WHEN** a member tries to submit with an expired or replaced link, or with a link issued to another account
- **THEN** the system denies the request

### Requirement: Experience change review

The system SHALL keep the current Experience unchanged while a change request
awaits administrator review. It SHALL allow at most one pending request per
Experience. An administrator SHALL be able to approve or reject an edit or
removal request, and the requester SHALL be able to see its status.

#### Scenario: Administrator approves an edit

- **WHEN** an administrator approves an author's proposed feedback, recommendation, or interaction changes
- **THEN** those changes replace the current values without changing creation date or visibility
- **AND** the existing restriction on recommending a public respondent does not prevent the approved edit

#### Scenario: Administrator approves removal

- **WHEN** an administrator approves removal of a published or unpublished Experience
- **THEN** it is hidden from member views, APIs, counts, statistics, and future publication
- **AND** its content and decision remain available for administration
- **AND** any reciprocal Experience retains its existing visibility

#### Scenario: Administrator rejects a request

- **WHEN** an administrator rejects a pending request
- **THEN** the Experience remains unchanged
- **AND** the requester can see the rejected status
