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

A search for server-side fetch, Axios, HTTP request helpers and Nostr relay clients did not find a member-supplied server HTTP URL consumer in these reviewed surfaces. No SSRF vulnerability is claimed by this initial review.

## Guardrails for any new server URL consumer

Before adding URL fetching or remote image imports, define permitted schemes and destinations, validate resolved IPv4/IPv6 addresses, and reject loopback, private, link-local and metadata-service ranges unless explicitly required by a trusted integration. Revalidate destinations on every redirect, prevent DNS resolution/connect mismatches, bound redirects, time, compressed and decoded response sizes, and use local deterministic test servers. Prefer an explicit destination allowlist for fixed integrations.

## Remaining verification

- Review dependency-level network behaviour and the actual deployment egress configuration.
- Check SMTP attachment and transport capabilities against all callers and future changes.
- Add runtime controls only for a demonstrated sink or an explicitly introduced integration; do not change intentional browser redirects under an SSRF label.
