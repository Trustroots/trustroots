# Design

`NostrSigningSession` owns a canonical scope and a monotonically changing revision.
Changing account, pausing signing, or changing keys invalidates captured work.
It contains no private keys and depends on no platform APIs. Native adapters own
URL parsing, encrypted persistence, device authentication and browser delivery.

The Keychain account is derived from a versioned, length-delimited server/member
scope. The server is the normalised API origin; account names are lowercased.
Signing is unavailable without an active scope. A legacy key is only a candidate:
it cannot sign until matched against a freshly loaded own profile or explicitly
claimed. Write the scoped key before deleting the legacy record; failure never
deletes the sole copy. An existing scoped key always takes precedence.

Secret backup uses LocalAuthentication device-owner authentication, captures the
session revision and rechecks it after authentication. The UI hides the secret
on backgrounding, account changes and key changes. No private-key copy control
is provided. New keys are validated before writing; Keychain failures are surfaced
and do not fall back to plaintext preferences, including on the simulator.

Unit tests cover the shared policy on Android and iOS adapter behaviour with an
in-memory Keychain port. Native UI coverage exercises generation, confirmation
and separation from profile linking. Physical-device authentication/Radio tests
remain explicit acceptance work; Linux cannot run Xcode or those checks.
