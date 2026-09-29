# Module HTTP client

Module API wrappers import `modules/core/client/api/http-client.js`. The client
uses a 120-second request timeout. This is a conservative limit for stalled
requests; it is not based on measured production latency. Introducing the
shared client originally added a 15-second limit where Axios previously had no
timeout. The longer limit gives slow requests more time without letting a
stalled request wait indefinitely.

Axios request options can override the timeout for individual requests. Avatar
uploads and newsletter CSV uploads explicitly use 120 seconds and accept
caller overrides, including `timeout: 0` to disable the timeout. Most other
wrappers do not currently expose request options in their public signatures.

A timeout aborts the browser's request. It does not cancel or roll back work
already performed by the server. Mutation callers must allow for an uncertain
outcome and must not automatically retry a mutation merely because its response
timed out. Password recovery and reset show guidance when there is no server
error message, retain the form, and send no automatic retry. Axios errors and
their response objects remain unchanged; response-less errors need a visible
fallback in the UI.

The request interceptor sets `X-Trustroots-Request: 1` on POST, PUT, PATCH and
DELETE, including bodyless requests. This header is reserved for the application
contract and is enforced even if a caller supplies another value or Axios's
`false` header-suppression flag. Other caller headers are preserved. GET and
HEAD do not receive an automatic mutation marker.

The marker is a constant, not a secret or an authentication token. It supports
the browser-origin checks proposed in PR #2907, including the marker required
for multipart requests; it does not replace the server's origin and fetch
metadata validation. Current module wrappers use application-root API URLs.
Using this client for cross-origin mutations would add a custom header and
could cause a CORS preflight.
