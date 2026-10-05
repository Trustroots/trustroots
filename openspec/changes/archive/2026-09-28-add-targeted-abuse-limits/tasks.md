## 1. Specification and implementation

- [x] 1.1 Add shared MongoDB counter storage with atomic increments, bounded windows, hashed keys and TTL expiry.
- [x] 1.2 Add validated configurable policies and production/test defaults.
- [x] 1.3 Apply IP-aware limits to sign-in, forgot/reset password and confirmation resend; apply member-aware limits to avatar uploads.
- [x] 1.4 Return 429 and `Retry-After` when a configured limit is exceeded; preserve existing general and messaging throttles.
- [x] 1.5 Document and verify the TTL index rollout prerequisite.

## 2. Verification

- [x] 2.1 Add anonymous tests for atomic concurrency, window expiry, storage errors, client-IP trust and spoofing, policy responses and endpoint coverage.
- [x] 2.2 Add at least one end-to-end test for a targeted limit.
- [x] 2.3 Run relevant lint, server coverage and end-to-end checks without lowering existing thresholds or test counts.
- [x] 2.4 Archive the change and update living specifications.
