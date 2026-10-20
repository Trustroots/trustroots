## ADDED Requirements

### Requirement: Entry-scoped Android contacts state

The Android Contacts screen SHALL keep its loaded list, request status and
retryable failure with the Navigation 3 entry that owns the Contacts page.
Loading the signed-in member profile to obtain its ID and loading contacts
SHALL be coordinated by an injectable screen ViewModel. The ViewModel SHALL
ignore stale request completions, cancel work when its entry is removed, and
deliver session invalidation once. ViewModel state and saved navigation state
SHALL not contain session credentials.

#### Scenario: Contacts load succeeds and the member returns from a profile

- **WHEN** a member opens a contact profile and then presses Back
- **THEN** the Contacts list and its state remain available
- **AND** the successful contacts request is not repeated

#### Scenario: Contacts load fails and can be retried

- **WHEN** a profile or contacts request fails without invalidating the session
- **THEN** the Contacts screen shows the existing failure text and a retry action
- **AND** retry starts a fresh request and replaces any stale result

#### Scenario: Contacts request invalidates the session

- **WHEN** either Contacts request returns an authentication failure
- **THEN** the existing session-invalidated callback runs once
- **AND** the authenticated shell clears the Contacts entry state

#### Scenario: Contacts entry is removed

- **WHEN** the owning Navigation 3 entry is removed while a request is active
- **THEN** its request is cancelled and its Contacts state is cleared
