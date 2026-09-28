## ADDED Requirements

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
