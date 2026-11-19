## ADDED Requirements

### Requirement: Shared policy for Nostranslation signing approvals

The shared native policy SHALL accept a signing request for review only from the
authenticated peer of an approved pairing owned by the active account. A
reviewable event SHALL be kind `27235`, have empty content, and contain exactly
one destination, method and SHA-256 payload tag. The policy SHALL restrict it to
the Nostranslation production review endpoint and method POST. The event's
timestamp SHALL be within 60 seconds of the current time, both at review and
approval. The approval SHALL be usable once and SHALL expire when the native
signing session or pairing is invalidated.

#### Scenario: Approved client requests a translation signature

- **WHEN** the authenticated peer submits a current Nostranslation review POST event
- **THEN** the shared policy prepares a review showing the destination
- **AND** the event can be handed to the signer once after explicit approval

#### Scenario: Request changes or expires before approval

- **WHEN** the event is stale or the native account, key or pairing changes before approval
- **THEN** the shared policy rejects the approval

#### Scenario: An unrelated event is requested

- **WHEN** the request comes from a different peer or targets another operation or endpoint
- **THEN** the shared policy offers no approval
