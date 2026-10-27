## Implementation

- [x] Add atomic per-member alert cooldown and queue plain-text support email.
- [x] Integrate alerts without changing throttle responses or role exemptions.
- [x] Cover concurrent claims, cooldown expiry, queuing/storage failures and email contents with server tests.
- [x] Add an API end-to-end regression for throttling and alert deduplication.
- [x] Run repository checks, update the messaging specification and archive the change.

Validation: 88 message controller tests, six alert service tests and 15 messaging
end-to-end checks passed. Lint, all typechecks and module dependency checks passed.
The broad client and server coverage runs encountered timeouts in existing suites
and were stopped; full-suite coverage remains unverified.
