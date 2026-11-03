## ADDED Requirements

### Requirement: Text service consumers use native ESM

The text sanitisation service SHALL expose its named functions and shared default service object directly from `text.server.service.mts`. Its production and test consumers SHALL import that implementation through ESM without a JavaScript compatibility wrapper or a `module.exports` export.

#### Scenario: Production code imports the text service

- **WHEN** a controller, model or service loads text sanitisation
- **THEN** it imports the owning `.mts` implementation directly and retains the existing sanitisation behaviour

#### Scenario: Server tests exercise the text service

- **WHEN** the text unit suite or message preview tests load the text service
- **THEN** they use ESM imports and exercise the same named functions and default service object used in production
