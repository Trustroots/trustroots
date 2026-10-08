## ADDED Requirements

### Requirement: Production script policy

The system SHALL forbid JavaScript eval and unnonced inline scripts in production, forbid object content, and restrict script origins to the application and required analytics providers. It SHALL retain nonce-authorised bootstrap scripts, blob map workers and development eval source maps.

#### Scenario: Production document is served

- **WHEN** the production application serves a document
- **THEN** script-src excludes unsafe-eval and unsafe-inline and includes a fresh per-response nonce
- **AND** object-src is none and unused wildcard script origins are absent

#### Scenario: Browser executes untrusted inline content

- **WHEN** an unnonced inline script is appended to a document
- **THEN** the browser blocks its execution while the application remains usable

#### Scenario: Developer uses hot reload

- **WHEN** the development application serves a document
- **THEN** eval source maps remain supported under a report-only policy
