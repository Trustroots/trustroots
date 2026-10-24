## Why

Approval updates an Experience before recording its decision. A failure between
these writes returns an applied change to the pending queue, where it can be
rejected and the comparison displays identical live and proposed values.

## What Changes

- Make approval a durable, retryable decision. Mark the Experience with the
  request that applied it so retries cannot apply an edit or removal twice.
- Keep uncertain approvals in processing, allow approval retries, and prevent
  rejection after approval starts. Reject pending requests in one atomic write.
- Preserve submitted original values and label older requests as current values.
- Explain recovery and unavailable Experiences in the review interface.

## Impact

Affected modules: experiences and admin. No new cross-module dependencies.
Optional schema fields retain compatibility with existing records; no migration
or replica-set requirement. Historical originals cannot be reconstructed.
Deploy server and client together; do not run the old approval handler alongside
the new handler during rollout. Existing administrator and support-team review permissions remain unchanged.
