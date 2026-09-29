- [x] Implement the shared configured Axios client and response error accessor.
- [x] Migrate module API wrappers and correct the offers-by URL.
- [x] Set longer multipart upload timeouts and pass the request marker header.
- [x] Add client tests for defaults, request options, cancellation, error access,
  and wrapper contracts. End-to-end coverage is unsuitable for transport
  defaults and Axios cancellation; these contracts are exercised at the client
  adapter and API wrapper level.
- [x] Update the living module HTTP client specification and archive this
  change after validation.
