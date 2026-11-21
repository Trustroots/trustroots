## ADDED Requirements

### Requirement: Profile action for an already-shared Experience

The web profile SHALL link the signed-in author to their existing Experience
instead of offering to create another for the same member.

#### Scenario: An author views a member's profile after sharing

- **WHEN** a member views another member's profile and already has an Experience for them
- **THEN** the desktop and mobile profile actions link to the existing card
- **AND** the action works while the author's Experience is pending or public

#### Scenario: A member can still share their own account

- **WHEN** a member views a profile and has not authored an Experience for that member
- **THEN** the profile offers the Share action, including when an incoming Experience awaits a reply
