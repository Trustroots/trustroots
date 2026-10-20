## ADDED Requirements

### Requirement: Navigation-scoped Android Circles state

The Android Circles screen SHALL keep catalogue, membership, filter and
selected-detail state in a ViewModel scoped to its Navigation 3 entry. The
ViewModel SHALL use immutable UI state and explicit user events, and its data
operations SHALL be injectable for deterministic tests. It SHALL NOT place
session cookies in UI state, saved state or navigation keys. Removing the
navigation entry or signing out SHALL clear its account-scoped state and cancel
its outstanding work.

#### Scenario: Member temporarily leaves Circles

- **WHEN** a member navigates to another tab while the Circles entry remains
  on the back stack
- **THEN** returning to Circles restores its loaded catalogue, membership
  state, filter and selected detail
- **AND** it does not repeat successful initial reads solely because of the
  temporary departure

#### Scenario: Member explicitly reselects Circles

- **WHEN** a member reselects the active Circles tab
- **THEN** the screen returns to the overview with an empty filter
- **AND** clears transient errors and membership-update state
- **AND** reloads the catalogue and memberships

#### Scenario: Circles entry is removed

- **WHEN** Navigation 3 removes a Circles entry from the back stack
- **THEN** its ViewModel is cleared and outstanding requests are cancelled
- **AND** a later Circles entry starts with fresh state

#### Scenario: Circle catalogue load fails and is retried

- **WHEN** loading circles or memberships fails for a reason other than an
  expired session
- **THEN** the screen shows the existing error and a Retry action
- **AND** Retry reloads both data sources without losing the current filter or
  selected detail
- **AND** a failed catalogue is not presented as a successful empty catalogue

#### Scenario: Member session expires during a Circles request

- **WHEN** a catalogue, membership or membership-update request reports an
  authentication failure
- **THEN** the ViewModel emits one identified invalidation event
- **AND** the existing parent session callback is delivered once and the event
  is acknowledged

#### Scenario: An obsolete Circles request completes

- **WHEN** a request is cancelled, superseded by a retry, or belongs to a
  previous account scope
- **THEN** its result does not overwrite the current screen state

#### Scenario: Member opens circle detail and presses Back

- **WHEN** a member opens a circle from a filtered overview and returns with
  Back
- **THEN** the selected detail is cleared
- **AND** the current overview filter and loaded data remain available
