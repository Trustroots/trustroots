# Contact confirmation in the React shell

## Why

Extract a bounded route migration from PR 2769 so it can ship independently on the current runtime.

## What Changes

- Render `/contact-confirm/:contactId` through the existing React shell.
- Preserve member-only access, recipient checks, missing or confirmed requests and confirmation submission.
- Keep links to Angular-owned workflows and existing API behaviour.

## Impact

Updates route ownership, page adapters and regression coverage. No runtime, dependency or database migration is required.
