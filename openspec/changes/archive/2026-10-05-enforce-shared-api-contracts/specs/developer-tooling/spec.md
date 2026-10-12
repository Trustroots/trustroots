## ADDED Requirements

### Requirement: Shared API contracts check payload construction

The project SHALL strictly check the server payload construction and client
consumption of the staff-blocker and experience APIs against shared contracts.
The experience contracts SHALL represent private payloads and reciprocal
responses without claiming that hidden fields are present.

#### Scenario: A server payload drifts from its shared contract

- **WHEN** a checked payload builder returns an incompatible field or omits a required field
- **THEN** the blocking typecheck command fails

#### Scenario: A client misuses an API response

- **WHEN** a client treats a reciprocal experience response as a complete experience or assumes private feedback is present
- **THEN** the blocking typecheck command fails

#### Scenario: Contract checking preserves runtime behaviour

- **WHEN** the server constructs a staff-blocker or experience response
- **THEN** existing HTTP shapes and privacy filtering remain unchanged
- **AND** existing client/server coverage requirements and end-to-end scenarios are retained
