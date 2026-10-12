## ADDED Requirements

### Requirement: Explicit HTTP methods and built-in request parsing

The application SHALL route requests using their actual HTTP method without
method override middleware and SHALL parse JSON, CSP report JSON and nested
URL-encoded form bodies using Express's built-in parsers. It SHALL retain the
existing request body size and form parameter limits. It SHALL NOT install
unused flash-message middleware.

#### Scenario: Request method is explicit

- **WHEN** a request includes an `X-HTTP-Method-Override` header
- **THEN** the header does not change the request method used for routing

#### Scenario: Supported request bodies are received

- **WHEN** a route receives JSON, an application/csp-report body or a nested URL-encoded form
- **THEN** it receives the parsed body using the existing parser options

#### Scenario: Request body is rejected

- **WHEN** a JSON body is malformed or a supported body exceeds the existing size limit
- **THEN** the parser rejects the body before the route handler runs
