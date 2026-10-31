## ADDED Requirements

### Requirement: Observable production mail configuration

Live mail mode SHALL require an explicit SMTP host, service or SMTP URL and SHALL reject non-SMTP transports. Configuration startup SHALL report the effective mail mode without credentials or message data. Explicit capture mode SHALL remain available for maintenance and SHALL clearly report that outgoing delivery is disabled.

#### Scenario: Live mode selects a non-sending transport

- **WHEN** live mail mode is selected with a JSON, stream or custom transport
- **THEN** configuration startup fails before a job can be processed
- **AND** the error does not expose transport credentials

#### Scenario: Live mode has no explicit SMTP destination

- **WHEN** live mail mode is selected without an SMTP host, service or SMTP URL
- **THEN** configuration startup fails with a configuration error

#### Scenario: Operator selects maintenance capture

- **WHEN** production explicitly selects capture mode
- **THEN** outgoing mail remains captured and mailbox intake remains disabled
- **AND** startup reports capture mode and that outgoing delivery is disabled

#### Scenario: Production selects a valid SMTP configuration

- **WHEN** production selects live mode with an SMTP destination and no non-SMTP transport
- **THEN** startup preserves the SMTP options and reports live mode
- **AND** this configuration validation does not claim to verify connectivity or inbox delivery
