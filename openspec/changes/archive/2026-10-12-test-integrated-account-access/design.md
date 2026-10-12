# Exercise combined account access flows

## Dependency and branch strategy

Implement against main after member sessions, digest action tokens, account-wide challenges and MFA have landed. If an integration branch is needed before then, identify its exact component commits and target the test PR at that branch so reviewers see the additional tests without duplicate feature diffs. Do not permanently replace the independent feature PRs with a duplicate aggregate PR.

## Matrix

- Password-first login with a proof-of-work challenge followed by MFA establishes one correctly enrolled session.
- Password reset consumes the action token once, invalidates prior sessions and still requires MFA.
- Email confirmation remains single-use and cannot establish a verified MFA session by itself.
- Revoking one session and signing out everywhere also work for MFA-verified members.
- Registration and first authenticated access respect the documented idle/absolute lifetime policy.
- Concurrent recovery-code, action-token, proof and revocation requests produce the documented single-use outcomes.
- Browser and native clients handle challenges and unsupported MFA capability explicitly, without interpreting an intermediate response as a signed-in member.

## Test isolation

Use anonymous fixtures, separate agents and isolated databases. Control time at the service boundary rather than waiting days or relying on real time-zone changes. Use real database compare-and-set operations for concurrency scenarios; mocked sequential counters are insufficient.

Register every new browser scenario in the feature-coverage catalogue. Preserve existing e2e scenarios and 100% source coverage. Keep the matrix small enough to run in the existing account-public CI group; add a separate group only if measured execution time requires it.

## Completion

This change is complete only when the tests run against the combined production middleware/routes and the current browser/native response contracts. Unavailable native MFA support must produce an explicit supported compatibility outcome, not a skipped assertion.

