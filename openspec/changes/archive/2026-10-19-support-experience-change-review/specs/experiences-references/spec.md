## ADDED Requirements

### Requirement: Independent support approval of Experience changes

The system SHALL allow support-team members to issue Experience change links and review requests. Each request SHALL retain the issuer of the link used at submission. A support-team member SHALL NOT approve a request submitted through their own link. Another support-team member SHALL be able to approve it. Administrators SHALL be able to approve any request, including requests submitted through their own links. Rejection SHALL remain available to the issuer. Requests without issuer attribution SHALL require administrator approval. Link replacement or expiry SHALL NOT alter a submitted request's issuer attribution. The queue SHALL explain when approval requires another reviewer.

#### Scenario: Support issuer attempts approval

- **WHEN** a support member attempts to approve an edit or removal submitted through their own link
- **THEN** approval is denied and the request remains pending

#### Scenario: Another support member approves

- **WHEN** a different support member approves the request
- **THEN** the change is applied

#### Scenario: Administrator approves their own link

- **WHEN** an administrator approves a request submitted through their own link
- **THEN** the change is applied

#### Scenario: Link is replaced after submission

- **WHEN** another staff member replaces a link after a request is submitted
- **THEN** the original issuer remains unable to approve as support

#### Scenario: Earlier request has no issuer attribution

- **WHEN** support attempts approval of a request without an issuer snapshot
- **THEN** approval is denied and an administrator can approve it
