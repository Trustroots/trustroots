# Member session controls

## Why

Reduce account takeover, data disclosure and abuse risk at existing Trustroots boundaries.

## What Changes

Add an own-session list, individual revocation and sign-out-everywhere. Enforce
server-side idle and absolute timeouts for every signed-in member. Privileged
admin tools use a separate password step-up instead of shorter session limits.
Require password confirmation for session management mutations. Do not collect
browser fingerprints or exact location.

## Impact

Affected modules: users, core, configuration and tests. Preserve client and server coverage thresholds and existing end-to-end tests. Document deployment and compatibility implications alongside implementation.
