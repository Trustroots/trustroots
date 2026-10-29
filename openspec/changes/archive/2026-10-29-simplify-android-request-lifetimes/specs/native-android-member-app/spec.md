## ADDED Requirements

### Requirement: Replaceable Android work has explicit cancellable request ownership

Replaceable Android ViewModel coroutine requests SHALL use one cancellable slot per operation.
Replacement, account/backend changes and entry removal SHALL cancel the
corresponding work. Superseded requests SHALL NOT publish state, including
during synchronous cancellation or startup callbacks.

#### Scenario: A newer request replaces the prior request

- **WHEN** a request slot receives a replacement request
- **THEN** the new job becomes current before the prior job is cancelled or the
  new job starts
- **AND** the prior job and its child work are cancelled
- **AND** the prior request cannot publish a late result

#### Scenario: The profile entry changes environment or is removed

- **WHEN** the authenticated account or backend changes, or Navigation 3
  removes the profile entry
- **THEN** each matching request slot is cancelled
- **AND** results from the prior environment or removed entry do not update
  state

#### Scenario: Session invalidation is emitted during other profile work

- **WHEN** a profile request reports an authentication failure while another
  request is active
- **THEN** the existing single-delivery invalidation event is preserved
- **AND** invalidation does not implicitly replace the request-slot
  cancellation policy

#### Scenario: Initial sections and explicit reference refreshes retain their ownership

- **WHEN** a member profile loads its sections or explicitly refreshes references
- **THEN** initial section requests remain children of the initial profile load
- **AND** explicit reference refreshes remain independently replaceable
