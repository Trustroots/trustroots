# database-platform Specification

## Purpose

TBD - created by archiving change upgrade-mongoose-6. Update Purpose after archive.

## Requirements

### Requirement: Mongoose and direct MongoDB client alignment

The application SHALL use Mongoose 6 with the MongoDB 4 driver used by its
direct database integrations while continuing to support the deployed MongoDB
4.4 server.

#### Scenario: Application and worker start

- **WHEN** the application and worker connect to MongoDB 4.4
- **THEN** models, sessions and background jobs use compatible client interfaces

### Requirement: Existing document behaviour

The ORM migration SHALL preserve existing document queries, validation,
indexing and persistence behaviour for member and messaging flows.

#### Scenario: Existing member completes a database-backed flow

- **WHEN** a member uses an existing database-backed feature after deployment
- **THEN** the feature reads and writes the same documents without data migration

### Requirement: Shared storage for targeted request limits

The system SHALL record targeted request counters in MongoDB using atomic increments that remain consistent across application instances. Counter documents SHALL contain only keyed digests for identities, expire at the end of a bounded window, and be cleaned up by a TTL index. Production deployment SHALL create the TTL index before enabling request limits. Test policies SHALL permit existing localhost test suites to run without exhausting limits.

#### Scenario: Concurrent instances update one counter

- **WHEN** concurrent application instances record requests for the same key and window
- **THEN** each request contributes exactly once to the shared count

#### Scenario: A counter window ends

- **WHEN** a counter reaches its expiry time
- **THEN** later requests use a new window and MongoDB can remove the expired document

#### Scenario: Counter storage fails

- **WHEN** MongoDB cannot record a targeted request
- **THEN** the request fails closed with HTTP 503
- **AND** the response does not expose the raw limiting identity or database error
