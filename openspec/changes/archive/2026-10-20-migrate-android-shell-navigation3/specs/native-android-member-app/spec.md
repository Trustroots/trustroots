## ADDED Requirements

### Requirement: Navigation 3 owns Android top-level member navigation

The authenticated Android member shell SHALL use Navigation 3 to own and
render its Circles, Search, Messages and Profile top-level navigation
history. Each visit SHALL have a unique entry identity, including repeated
visits to the same destination. After the parent has loaded the live
authenticated session, the active destination SHALL be restorable after
activity recreation. Top-level tab keys SHALL be serialisable and contain no
session credentials, cookies, account secrets or member-specific payloads. The
live authenticated parent SHALL remain the source of session and member data.

#### Scenario: Member switches between top-level destinations

- **WHEN** a member selects a different top-level destination
- **THEN** Navigation 3 records a new uniquely identified visit after the
  current one
- **AND** Back returns to the previous destination in the member's navigation
  history

#### Scenario: Member revisits a prior destination

- **WHEN** a member navigates Circles → Messages → Circles
- **THEN** the stack retains three distinct destination visits
- **AND** Back returns to Messages and then to the original Circles visit

#### Scenario: Member reselects the current destination

- **WHEN** a member selects the currently active top-level destination
- **THEN** the established destination reset behaviour runs
- **AND** no duplicate destination is added to navigation history

#### Scenario: Member opens a destination from a message alert

- **WHEN** an alert requests a conversation for the currently signed-in
  account
- **THEN** the member shell selects Messages and opens the requested
  conversation through its existing screen navigation state
- **AND** Back follows the existing origin history after leaving the
  conversation

#### Scenario: Member cancels predictive Back

- **WHEN** a member starts and cancels a predictive Back gesture at the
  top-level shell
- **THEN** the current destination and its navigation history remain intact

#### Scenario: Member completes predictive Back

- **WHEN** a member completes a predictive Back gesture at the top-level shell
- **THEN** exactly the current destination visit is removed
- **AND** its previous destination becomes active

#### Scenario: Activity is recreated in an authenticated destination

- **WHEN** Android recreates the activity while the member is using a
  top-level destination
- **THEN** after the parent restores the live session, saved navigation state
  restores the active safe destination and its distinct visit history
- **AND** authentication is still obtained from the live session store
- **AND** no session credential or member-specific secret is restored from a
  navigation key

### Requirement: Navigation 3 preserves native leave and nested Back behaviour

Top-level Navigation 3 Back handling SHALL preserve existing menu-page,
embedded-browser and nested-screen Back behaviour. A dirty editable form SHALL
be offered the existing keep-editing or discard decision before a top-level
navigation action or Back pop commits. Cancelling predictive Back SHALL NOT
commit a pop or bypass the leave decision.

#### Scenario: Member backs out of a nested menu page

- **WHEN** a member presses Back while a menu subpage or embedded browser is
  open
- **THEN** the nested page or browser closes before the top-level history is
  popped

#### Scenario: Member leaves a dirty form through top-level navigation

- **WHEN** a member selects another top-level destination while a form has
  unsaved changes
- **THEN** the existing leave guard asks whether to keep editing or discard
- **AND** keeping edits leaves the form and top-level destination unchanged
