## ADDED Requirements

### Requirement: Recoverable Experience approval

The system SHALL preserve an approval in progress across write failures and
SHALL allow an administrator to finish it without applying the same change twice.
It SHALL prevent rejection once approval starts. A confirmed unavailable
Experience SHALL remain rejectable when this request has not applied its change.

#### Scenario: Recording an applied decision fails

- **WHEN** the Experience update succeeds but saving the approved status fails
- **THEN** the request remains processing and cannot be rejected
- **AND** retrying approval completes the decision without changing the Experience again

#### Scenario: An Experience is unavailable

- **WHEN** approval finds no available Experience and no marker for this request
- **THEN** the administrator receives an actionable conflict and can reject the request

### Requirement: Stable Experience review comparison

The system SHALL store original feedback, recommendation and interactions with
new requests and display them separately from proposed values. Older requests
without originals SHALL explicitly display current values instead.

#### Scenario: The live Experience changes

- **WHEN** an administrator reviews a request after the live Experience changes
- **THEN** the stored original values remain unchanged in the comparison
