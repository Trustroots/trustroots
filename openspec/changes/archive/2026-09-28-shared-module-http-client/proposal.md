## Why

Module API wrappers currently use Axios' unconfigured global client, so request
timeouts and shared transport behaviour have no single place to configure.
One offers lookup also uses a relative URL that can resolve against the current
browser path.

## What Changes

- Add a shared Axios client for module API wrappers with a finite default
  timeout and normal Axios support for per-request options such as cancellation,
  timeout overrides, and headers.
- Provide a common accessor for Axios response errors and use it in existing
  endpoint-specific error handling without changing rejection or return
  contracts.
- Route module API wrappers through the shared client and make the offers-by
  URL root-relative.
- Give multipart uploads an explicit longer timeout and retain the browser
  request marker header required by the mutation-origin checks.

## Capabilities

### Added Capabilities

- `module-http-client`: Module API wrappers use consistent HTTP defaults while
  allowing individual requests to supply Axios options.

## Impact

This affects client API wrappers and their tests. Successful response values,
error propagation, endpoint-specific 404 handling, and server routes remain
unchanged. No data migration or deployment change is required.
