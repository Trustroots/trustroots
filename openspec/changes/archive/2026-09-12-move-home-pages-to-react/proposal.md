# Homepage and information pages in the React shell

## Why

Extract a bounded route migration from PR 2769 so it can ship independently on the current runtime.

## What Changes

- Render `/`, `/about` and `/safety` through the existing React shell.
- Preserve circle landing queries, guest signup links, photo credits and existing page content.
- Keep links to Angular-owned workflows and existing API behaviour.

## Impact

Updates route ownership, page adapters and regression coverage. No runtime, dependency or database migration is required.
