# Add guarded MongoDB migration verification tools

## Why

The MongoDB 7 upgrade needs operator-run checks for the current server and FCV,
application index/read readiness, and a deliberate FCV advance after a staged
binary upgrade. These checks should produce useful evidence without exposing
credentials, database content or infrastructure identifiers, and must never
run implicitly during application startup.

## What Changes

- Add an explicit command-line tool with read-only `inspect` and `verify`
  commands, using a required MongoDB URI environment variable and no default
  deployment URI.
- Report allowlisted server version, FCV, topology summary, model/index/read
  verification counts, and safe error codes without outputting credentials,
  hostnames, database names, document contents or raw driver errors.
- Add an explicit standalone-only `advance-fcv --source X.Y --target X.Y`
  command that accepts only 4.4→5.0, 5.0→6.0, or 6.0→7.0; checks the live
  binary target and FCV source before the single FCV command; and verifies the
  resulting FCV.
- Keep upgrade binaries, FCV changes, production deployment actions and
  application startup independent of this tool. No command upgrades binaries,
  changes FCV automatically, or runs without explicit operator invocation.

## Capabilities

### New Capabilities

- `mongodb-migration-operations`: Defines sanitized read-only readiness checks
  and guarded sequential FCV advancement for operator-run migration work.

### Modified Capabilities

- `database-platform`: Require explicit, guarded FCV transitions and evidence
  checks before migration progression.

## Impact

This adds an operator-invoked CLI, focused tests and package scripts. It does
not change normal application startup, application data, deployment
configuration or server binaries. An explicit `advance-fcv` invocation changes
MongoDB administrative FCV metadata. The CLI only uses a URI supplied through
its required environment variable and never prints it.
