# Design

## Commands and connection boundary

Expose `inspect`, `verify` and `advance-fcv` as explicit subcommands. Read the
connection only from required `MONGODB_URI`; reject missing/blank values and
never include its value in logs or reports. The tool is not imported by the
application or worker. The migration operator chooses the intended environment
and invokes the command directly.

`inspect` reads server build information, FCV, `hello` topology state and
replica-set health where applicable. `verify` performs those checks and
read-only checks against the app's registered Mongoose models: confirm declared
indexes exist and run a bounded `_id`-only query for each model. Disable
Mongoose automatic index creation and collection creation during verification.
Report only counts and pass/fail codes; do not return matched document values,
index names, URIs, server addresses, database names or raw errors.

## Guarded FCV transition

Require both `--source` and `--target`. The accepted transitions are exactly
4.4→5.0, 5.0→6.0 and 6.0→7.0. Before issuing a command, connect and verify the
server's binary major/minor is the requested target, the current FCV equals the
requested source, and the endpoint is a writable standalone server. Reject
replica-set and sharded topologies because this tool does not independently
inspect every member's binary state. `inspect` can report topology and
replica-set member health, but that observation is not an upgrade-readiness
claim. Reject unsupported topologies and any mismatch without sending
`setFeatureCompatibilityVersion`. Send one
FCV-setting command for that explicit transition; include `confirm: true` for
MongoDB 7.0. Read back FCV and return success only if it equals target.

This command changes FCV only. It never installs or upgrades server binaries,
changes application traffic, creates backups, or executes as a side effect of
`inspect`, `verify`, startup or deployment. A production operator must still
follow the approved deployment procedure and take a consistent recovery point.

## Output and error handling

Write JSON with a versioned schema, UTC timestamp, action, allowlisted
observations and check statuses. Sanitize failures to a stable error code and
stage. Driver messages and stack traces may include connection or host details,
so they are not printed. Set a nonzero exit code on any failed check or FCV
transition. Never write a report to disk unless an operator explicitly redirects
stdout to an approved destination.

## Tests

Unit-test transition parsing, every binary/FCV/topology guard, command payload,
read-back validation, sanitized errors and report redaction with mocked admin
responses. Add read-only verification tests for missing indexes, successful
model queries and disabled index/collection creation. A live staging
verification can be run separately with an explicit URI; the test suite must
not connect to a deployment or require production credentials.
