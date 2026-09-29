# module-http-client Specification

## Purpose
Define consistent HTTP defaults and request options for module API wrappers.
## Requirements
### Requirement: Module API wrappers share a configured HTTP client

Module API wrappers SHALL make requests through one shared Axios client with a
finite default timeout. The client SHALL accept standard per-request Axios
options, including cancellation signals, timeout overrides, and headers.

#### Scenario: A module API request uses shared defaults

- **WHEN** a module API wrapper sends a request without an explicit timeout
- **THEN** the request uses the shared client's finite default timeout

#### Scenario: A caller customises or cancels a request

- **WHEN** a module API wrapper supplies standard Axios request options
- **THEN** the shared client applies those options to that request

#### Scenario: An HTTP request fails

- **WHEN** a module API wrapper rejects with an Axios response error
- **THEN** the original rejection and endpoint-specific handling are preserved,
  and shared code can access its response without wrapping the error

### Requirement: Offers-by uses an application-root URL

The offers-by API wrapper SHALL request the application-root `/api/offers-by`
route regardless of the current browser path.

#### Scenario: Looking up offers for a member

- **WHEN** the offers-by wrapper requests offers for a member
- **THEN** the request URL begins with `/api/offers-by/`
