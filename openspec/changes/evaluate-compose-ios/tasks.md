## 1. Assessment PR

- [x] 1.1 Inspect Android/iOS source, test intent and release configuration.
- [x] 1.2 Compare separate apps, shared logic and shared logic plus Compose UI.
- [x] 1.3 Document agreed integration, platform boundaries and toolchain gaps.
- [x] 1.4 Define incremental stages, estimates, acceptance and rollback gates.
- [x] 1.5 Validate revised OpenSpec, formatting, links and repository checks.

## 2. Implementation and verification

- [x] 2.1 Add and validate implementation spec deltas before application changes.
- [x] 2.2 Resolve toolchain and build shared library in both existing apps.
- [x] 2.3 Bridge existing secure sessions, caches and host navigation.
- [x] 2.4 Share real-API sign-in, profile, inbox, conversation and reply.
- [ ] 2.5 Verify native journeys, platform behaviour and build/runtime costs.
- [ ] 2.6 Record results and remaining parity gaps before expanding migration.
- [ ] 2.7 Update living specs and archive after the agreed gates are complete.

The shared framework and debug journey are implemented in the existing hosts.
Android and iOS simulator runs of the initial journey are documented in
`apps/compose-assessment.md`. Dashboard and bottom navigation extend that same
journey in PR #3730. Remaining verification covers supported physical devices
and older iOS versions, accessibility, secure session recovery, offline
behaviour, and comparative startup, package size and build costs. Record those
results before deciding on native-default rollout.
