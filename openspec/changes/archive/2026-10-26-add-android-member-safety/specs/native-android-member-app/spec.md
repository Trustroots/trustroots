## ADDED Requirements

### Requirement: Native Android profile member safety controls

The Android app SHALL provide Block/Unblock and Report member actions in another member's profile overflow menu using the existing authenticated blocked-member and support APIs. Own profiles SHALL NOT offer these actions. Safety state and report drafts SHALL belong to the profile visit and SHALL be cleared when the account or backend changes.

#### Scenario: Blocking state is loaded

- **WHEN** a member opens another member's profile
- **THEN** the app loads the viewer's current blocked-member list without using an offline cached block list
- **AND** a failed lookup is shown with retry and is not treated as a confirmed unblocked state
- **AND** Block/Unblock mutation is unavailable until the state is known

#### Scenario: Member blocks or unblocks another member

- **WHEN** the member chooses Block or Unblock
- **THEN** a confirmation is shown before any mutation
- **AND** cancelling sends no request
- **AND** a confirmed change uses the existing PUT or DELETE blocked-member route
- **AND** a successful block shows blocked status and hides the profile message action
- **AND** successful unblock restores the message action
- **AND** failed changes preserve the previously confirmed blocking state and show an error
- **AND** repeated taps while a change is pending do not duplicate requests

#### Scenario: Member reports another member

- **WHEN** a member chooses Report member
- **THEN** a native form identifies the reported member and accepts a nonblank report message
- **AND** submission posts the target username and message to the existing support route
- **AND** pending submission cannot be duplicated
- **AND** success is clearly acknowledged
- **AND** failure keeps the draft and allows retry
- **AND** the draft survives Activity recreation without replaying a completed submission

#### Scenario: Safety work becomes stale

- **WHEN** the account or backend changes while safety work is outstanding
- **THEN** old responses do not update the new environment
- **AND** private report drafts and success messages are cleared
- **AND** authentication failures use the existing single-delivery session-invalidation flow
