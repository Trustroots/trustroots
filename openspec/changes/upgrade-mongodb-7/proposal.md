# Upgrade the database platform to MongoDB 7

## Why

Trustroots currently declares MongoDB 4.4 as its server ceiling. The application
already runs Mongoose 9.11.4, whose MongoDB driver line is 7.x, alongside
independently installed driver copies used by Agenda and Agendash. The service
needs a rehearsed, supportable move to MongoDB 7 and a coherent client dependency
graph before production can be considered.

## What Changes

- Raise the supported MongoDB server target to 7.0 and record the compatibility
  and acceptance requirements for application, worker, session and job tools.
- Keep MongoDB 4.4 and 7.0 in CI during the transition so current and target
  server lines continue to be exercised.
- Consolidate direct MongoDB driver dependencies onto the 7.x line used by
  Mongoose 9.11.4 using package releases whose peer contracts include that
  line. The supported Agenda path is Agenda 6 with `@agendajs/mongo-backend`
  and Agendash 8; adapt the worker and dashboard integration and retain the
  existing job collection. Keep connect-mongo on the supplied Mongoose
  connection and verify that integration against its declared peer contract.
- Document a staged, separately approved MongoDB 4.4 → 5.0 → 6.0 → 7.0 upgrade,
  with a feature compatibility version (FCV) gate and acceptance evidence at
  every major-version boundary.
- Require a verified recovery rehearsal that includes `agendaJobs`; the current
  `fetchMongoDumps.sh` omits that collection and cannot alone serve as a complete
  application recovery point.
- Defer MongoDB 8 or later. The requested target is MongoDB 7.0, which is
  supported through 31 August 2027.

## Capabilities

### Modified Capabilities

- `database-platform`: Raise the server compatibility target and define the
  tested client-driver topology, staged upgrade gates, recovery coverage and
  post-upgrade application acceptance.

## Impact

This affects the MongoDB engine requirement, package manifests and lockfile,
database CI and test images, deployment configuration and operational docs.
The migration is intended to preserve existing application data and collection
shapes. This proposal and its runbook are planning artifacts: they do not
authorise or perform a production database change.
