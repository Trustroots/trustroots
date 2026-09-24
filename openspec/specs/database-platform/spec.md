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
