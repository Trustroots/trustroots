## ADDED Requirements

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
