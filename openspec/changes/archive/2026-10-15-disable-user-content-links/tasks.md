## Implementation

- [x] Validate the proposal before implementation.
- [x] Add shared link unwrapping and apply it to user-content display paths.
- [x] Remove editor link controls and update help text.
- [x] Preserve dedicated network links except Couchsurfing.
- [x] Add unit and end-to-end regression coverage and run required checks.
- [x] Update living specs and archive the change.

Validation: pnpm check passed (251 client suites, 1,874 client tests and four configuration tests). All 18 focused browser scenarios passed. Full client and server coverage remained at 100% for statements, branches, functions and lines; the server suite passed 2,454 tests with 22 existing pending tests. The module graph matches its baseline. Storage and server implementation were unchanged.
