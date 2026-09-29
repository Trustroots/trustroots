# Outbound request review

## Reviewed application surfaces

This initial review covers the runtime server modules, configuration and maintenance scripts at origin/main eb28cb206. It does not establish a vulnerability in an uninspected dependency or production deployment.

| Surface | Destination control | Finding |
| --- | --- | --- |
| `modules/core/server/jobs/send-email.server.job.js` | SMTP transport options come from deployment configuration | Outbound SMTP is present; application callers do not choose an HTTP fetch URL. |
| `modules/core/server/services/email.server.service.js` | Rendered mail fields are constructed explicitly and queued through Agenda | Reviewed rendering does not pass arbitrary attachment URLs into the mail job. |
| `modules/users/server/controllers/users.avatar.server.controller.js` | Avatar responses redirect the browser to configured/provider-derived image URLs | These redirects do not fetch an image on the server. Review redirect construction separately from SSRF. |
| `modules/search/client/services/nostr.client.service.js` | Nostr retrieval runs in the browser | This is a client network boundary, not a server-side fetch sink. |
| SparkPost webhook controller | Authenticated inbound request handler | An inbound webhook does not itself establish an outbound URL fetch sink. |
| `modules/core/server/services/spam.server.service.js` | Akismet API key and blog URL come from deployment configuration | The blog URL is submitted as data; the dependency constructs its HTTP endpoint separately. Member message fields do not select the endpoint. |

A search for server-side fetch, Axios, HTTP request helpers and Nostr relay clients did not find a member-supplied server HTTP URL consumer in these reviewed surfaces. No SSRF vulnerability is claimed by this initial review.

## Guardrails for any new server URL consumer

Before adding URL fetching or remote image imports, define permitted schemes and destinations, validate resolved IPv4/IPv6 addresses, and reject loopback, private, link-local and metadata-service ranges unless explicitly required by a trusted integration. Revalidate destinations on every redirect, prevent DNS resolution/connect mismatches, bound redirects, time, compressed and decoded response sizes, and use local deterministic test servers. Prefer an explicit destination allowlist for fixed integrations.

## Dependency findings and review limits

- The installed `akismet-api` 5.3.0 client (`lib/akismet.js`) constructs its endpoint from its protocol, API key, host and API version. This application supplies only the configured key, blog and charset, leaving the HTTPS and Akismet host defaults in place. Member-supplied comment fields become request data. This establishes destination control for the reviewed call, without asserting that all dependency network behaviour has been audited.
- The sole application producer of the `send email` Agenda job is `renderEmailAndSend`. Its renderer constructs an explicit mail object containing recipient, sender, subject, rendered text/HTML, optional reply address and fixed SMTP headers. It does not copy arbitrary template parameters or attachment URL options into the job. Direct database/job modification and deployment transport configuration remain privileged boundaries.
- Review the actual deployment egress configuration and dependency-level redirect, timeout and response-size behaviour before introducing a member-selected network destination. No production configuration or network access was exercised for this review.
- Add runtime controls only for a demonstrated sink or an explicitly introduced integration; do not change intentional browser redirects under an SSRF label.
