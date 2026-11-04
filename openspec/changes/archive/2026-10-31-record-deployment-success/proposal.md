## Why

Issue #3502 needs a successful-deployment event distinct from process startup.
The deployment helper already owns readiness checks and rollback, but currently
only prints the result. A durable receipt is the first independently reviewable
step towards deployment emails.

## What Changes

- Persist an attempt before replacing containers, with a unique event identity
  and both immutable image IDs.
- Mark it successful only after readiness and login verification, including the
  deployed build commit and a separate readiness timestamp.
- Allow an operator to recover an interrupted receipt by rechecking the same
  images and canonical origin, reusing its event identity.
- Keep receipt completion failures outside automatic rollback.

## Capabilities

### New Capabilities

- `deployment-success-events`: Durable, recoverable readiness receipts.

## Impact

Only the Python deployment helper, its tests and operations documentation change.
No database migration or application startup hook is introduced. Operators must
copy the updated helper and retain its journal beside Compose. This PR sends no
email: production/mail-mode gating, recipient eligibility and resumable queueing
remain follow-up work under #3502. Browser e2e tests are unsuitable for this
operator-only flow; fake Docker/HTTP tests exercise the deployment entry point.
