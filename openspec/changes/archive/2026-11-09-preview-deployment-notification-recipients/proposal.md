## Why

Issue #3502 already has durable deployment readiness receipts. Define and verify
who would receive a deployment notification before wiring receipts to the queue.

## What Changes

- Add an operator command that previews the number of eligible destinations.
- Require explicit production tier, production runtime, a canonical production
  domain and effective live mail before querying users.
- Select active greeters and admins with valid current addresses, deduplicated
  by normalised destination. Print the count only.

## Capabilities

### Modified Capabilities

- `deployment-success-events`: Add a read-only recipient preview.

## Impact

The preview reads MongoDB and has no queue or SMTP effects. An operator command
test covers the entry point because the feature has no browser surface.
