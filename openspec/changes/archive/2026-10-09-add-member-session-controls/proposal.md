# Member session controls

## Why

Reduce account takeover, data disclosure and abuse risk at existing Trustroots boundaries.

## What Changes

Add an own-session list, individual revocation and sign-out-everywhere. Enforce server-side idle and absolute timeouts, shorter for privileged accounts. Require password confirmation for session management mutations. Do not collect browser fingerprints or exact location.

## Impact

Affected modules: users, core, configuration and tests. Preserve client and server coverage thresholds and existing end-to-end tests. Document deployment and compatibility implications alongside implementation.
