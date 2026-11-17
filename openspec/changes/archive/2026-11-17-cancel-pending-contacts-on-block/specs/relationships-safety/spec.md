## ADDED Requirements

### Requirement: Blocking cancels pending contact requests

The server SHALL cancel pending contact requests between two members when one blocks the other. Unblocking SHALL NOT restore cancelled requests. Confirmed contacts SHALL remain intact.

#### Scenario: Either participant blocks the other before confirmation

- **WHEN** the sender or recipient of a pending contact request blocks the other member
- **THEN** the request is removed from both members' contact lists
- **AND** its confirmation link can no longer be used
- **AND** unblocking later does not restore the request

#### Scenario: A pending request still exists for a blocked pair

- **WHEN** the recipient tries to confirm a pending request and either participant has blocked the other
- **THEN** the server rejects confirmation

### Requirement: Account deletion removes pending contact requests

The server SHALL remove pending contact requests sent or received by a deleted member.

#### Scenario: A request sender deletes their account

- **WHEN** the sender of a pending contact request deletes their account
- **THEN** the request is removed from the recipient's contact list
- **AND** its confirmation link can no longer be used
