# MongoDB migration verification tool

This operator-invoked CLI provides read-only deployment checks and one guarded
FCV transition. It does not upgrade MongoDB binaries, change application
traffic, create backups, or run during application startup. Do not use it as a
substitute for the deployment's approved upgrade procedure or recovery plan.

## Connection handling

Every command requires `MONGODB_URI` in the process environment. There is no
default or repository-config fallback. Export the variable before running the
commands below; `verify` requires an explicit database name in the URI path.
The tool never prints the URI,
credentials, host names, database name, raw MongoDB error, or document values.
It writes a sanitised JSON report to standard output. Keep any report in an
approved access-controlled location.

## Commands

Run from the repository root:

```sh
pnpm run mongo:migration inspect
pnpm run mongo:migration verify
```

`inspect` reads the server build version, FCV, endpoint role and replica-set
health. It issues no database write command and does not import application
configuration or initialise Agenda.

`verify` runs `inspect`, then loads the application Mongoose model definitions
with automatic index and collection creation disabled. It performs a bounded
`_id`-only read for each registered model and checks that each declared index
key and semantic option is present. The report contains only aggregate model,
read and index counts. It does not return matched documents or index names.
Run it against an environment where the operator expects every application
collection and declared index to exist.

## Explicit FCV advancement

After upgrading binaries by the approved procedure and completing its health and
recovery gates, an operator may explicitly request one FCV transition:

```sh
pnpm run mongo:migration advance-fcv --source 6.0 --target 7.0
```

Only `4.4 → 5.0`, `5.0 → 6.0` and `6.0 → 7.0` are accepted. The tool checks the
connected server's binary series equals the requested target, the live FCV
equals the requested source, and the endpoint is a writable standalone server.
Replica-set and sharded deployments are rejected for FCV advancement because
this CLI does not independently inspect every member's binary state. The
`inspect` command can report observed topology and replica-set member health,
but that report is not a migration-readiness decision.

The 7.0 FCV command includes MongoDB's required `confirm: true`; earlier target
versions use their version-appropriate command fields. The command reads FCV
again after the change and reports success only when it matches the requested
target. Any failed guard exits nonzero without issuing the FCV command.

This FCV command is a material database change. Use it only after explicit
operator review of the source/target, binary state, consistent recovery point,
topology health and approved change window. No production operation is run while
testing this CLI.
