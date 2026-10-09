# Member-session controls deployment

Session controls track each authenticated browser session using a keyed opaque
identifier. They do not collect browser fingerprints or precise location.

Every signed-in member, including administrators and welcome-team greeters, has
a seven-day idle timeout and a 28-day absolute lifetime. Privileged admin APIs
do not shorten that session. Instead they require a password step-up: after
sign-in, the first admin request asks for the current password and unlocks
admin tooling for thirty minutes (`adminElevation.lifetimeMs`). Existing
signed-in sessions are enrolled on their next authenticated request after
deployment; their clocks begin at that request so deployment does not sign
everyone out at once.

Revoked records remain as tombstones until their absolute expiry so a concurrent
request cannot recreate a revoked session. Production disables Mongoose
automatic index creation, so create the `MemberSession` TTL index before
deployment:

```sh
npm run ensure-indexes -- MemberSession
```

The application still rejects sessions after their absolute lifetime when the
TTL index is missing, but expired records will not be removed automatically.
