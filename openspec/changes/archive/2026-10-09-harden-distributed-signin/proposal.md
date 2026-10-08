# Account-wide sign-in protection

## Why

Reduce account takeover, data disclosure and abuse risk at existing Trustroots boundaries.

## What Changes

Track attempts for each normalised submitted username or email across trusted
client addresses and require an expiring proof-of-work challenge before
elevated-activity password verification. Keep address-based limits and KDF
overload protection; avoid account lockouts. Update browser, Android, and iOS
sign-in clients to solve and submit one challenge retry.

## Impact

Affected modules: users, core, configuration, browser and native sign-in clients,
and tests. Deploy server and clients together; all application instances must
share the existing session-signing secret and Mongo counter store. No data
migration or new secret is required. Preserve client and server coverage
thresholds and existing end-to-end tests.
