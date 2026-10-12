## ADDED Requirements

### Requirement: Focused native runtime utilities

The application SHALL use native UUID generation and file removal, a schema validator for integer circle member counts, and local pagination middleware instead of direct uuid, del, mongoose-integer and express-paginate dependencies. File removal SHALL refuse the working directory and paths outside it, tolerate missing files and report deletion failures. Pagination SHALL preserve existing defaults, limit bounds, offsets, structured query filters and next-page Link headers.

#### Scenario: A paginated API is requested

- **WHEN** a request supplies page, limit and structured filters
- **THEN** page and limit are normalised using existing defaults and bounds
- **AND** the next-page link preserves filters and changes the page number

#### Scenario: A member account is removed

- **WHEN** account removal reaches upload cleanup
- **THEN** the member's upload folder is removed recursively using native file operations
- **AND** missing uploads do not fail cleanup
- **AND** a deletion failure completes the request with the existing removal error response

#### Scenario: A circle member count is validated

- **WHEN** a circle has a fractional member count
- **THEN** schema validation rejects the count with the existing integer-validation message

#### Scenario: A page nonce is generated

- **WHEN** the server renders a page requiring a CSP nonce
- **THEN** the nonce is generated using Node.js crypto.randomUUID
