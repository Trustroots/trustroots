## Implementation

- [x] Validate proposal before implementation.
- [x] Port the station catalogue, radio protocol and React interface.
- [x] Verify matching identities and preserve existing relay interoperability.
- [x] Provision the Radio circle without overwriting an existing circle.
- [x] Add unit and end-to-end coverage; run checks, coverage and build.
- [x] Archive the proposal and update the living specification.

## Rollout

After deploying Trustroots, run `NODE_ENV=production pnpm ensure-radio-circle`
with the target database configuration. The command preserves existing circle
details and can be run more than once. Verify live streams, then add a prominent
link to `https://www.trustroots.org/circles/radio` on the existing Nostroots
example. Keep both interfaces available and retain station hash links.
