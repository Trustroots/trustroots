# Recovery and outcome pages in the React shell

## Why

Extract a bounded route migration from PR 2769 so it can ship independently on the current runtime.

## What Changes

- Render `/password/forgot`, `/password/reset/success`, `/password/reset/invalid` and `/confirm-email-invalid` through the existing React shell.
- Preserve username prefill, recovery submission responses and links into existing authentication workflows.
- Keep links to Angular-owned workflows and existing API behaviour.

## Impact

Updates route ownership, page adapters and regression coverage. No runtime, dependency or database migration is required.
