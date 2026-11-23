## ADDED Requirements

### Requirement: Experiences awaiting a reply on the owner's profile

The web Experiences page SHALL group received Experiences with no reciprocal
Experience for the signed-in profile owner.

#### Scenario: An owner has pending and public Experiences awaiting a reply

- **WHEN** an owner opens their Experiences page
- **THEN** the page shows a single section of received Experiences awaiting a reply
- **AND** pending cards appear first, ordered by the earliest publication deadline, with the existing countdown and reply action
- **AND** public cards follow, ordered newest first, with their existing reply action
- **AND** public totals include those cards
- **AND** each Experience card appears once

#### Scenario: A member visits someone else's Experiences page

- **WHEN** a signed-in member opens another member's Experiences page
- **THEN** the page follows the existing visibility rules and does not show the owner's reply section
