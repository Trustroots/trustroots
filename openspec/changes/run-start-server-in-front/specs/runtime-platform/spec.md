## ADDED Requirements

### Requirement: Start serves requests in front of Express

Outside development, the HTTP server SHALL pass every request to the TanStack
Start server built by `pnpm build`. Requests that match a Start server route
SHALL be answered by Start; every other request SHALL be handed to the Express
app on the same Node request and response. In development the Vite server
SHALL keep serving `/assets/` and proxying other requests to Express.

#### Scenario: Request not served by a Start route

- **WHEN** a request does not match a Start server route
- **THEN** Express answers it with the same status, headers and body as when
  it listened directly

#### Scenario: Shell prerender

- **WHEN** `pnpm build` prerenders the SPA shell
- **THEN** Start renders the shell document without Express
