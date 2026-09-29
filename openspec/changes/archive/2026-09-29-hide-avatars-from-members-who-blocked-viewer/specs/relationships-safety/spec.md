## MODIFIED Requirements

### Requirement: Blocking

The system SHALL let members block and unblock other members, and SHALL hide
blocked relationship actions and protected profile access. A member who has
blocked another member SHALL retain direct access to that member's profile and
avatar to reach the unblock control. A member who has been blocked SHALL not
receive the profile owner's avatar; administrators retain their moderation
access.

#### Scenario: Member blocks another member

- **WHEN** a member blocks another member
- **THEN** the system records the block and hides protected relationship actions for that pair

#### Scenario: Member removes a block

- **WHEN** a member unblocks another member
- **THEN** the system removes the block and restores permitted relationship actions

#### Scenario: Blocked member requests the blocker's avatar

- **WHEN** a member requests the avatar of a member who has blocked them
- **THEN** the system returns the default avatar

#### Scenario: Blocker requests the blocked member's avatar

- **WHEN** a member requests the avatar of a member they have blocked
- **THEN** the system returns the member's avatar so the blocker can use the profile's unblock control

#### Scenario: Administrator requests a blocked member's avatar

- **WHEN** an administrator requests the avatar of a member who has blocked them
- **THEN** the system returns the member's avatar
