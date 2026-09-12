## Implementation

- [x] Add role and limited API permissions.
- [x] Support administrator grants and revocations with audit notes.
- [x] Update route guards, navigation and role management UI.
- [x] Add server, client and end-to-end coverage and verify coverage remains at 100%.
- [x] Update living specs and archive the proposal after verification.

## Verification

- Full client suite: 260 suites, 1,483 tests passed; 100% statements, branches, functions and lines.
- Full server suite: 1,626 tests passed, 28 pending; 100% statements, branches, functions and lines.
- `npm run coverage:check -- --require-full` passed; thresholds and baselines unchanged.
- Focused acquisition and role-management browser run: all five tests passed, including authentication setup. The wrapper's whole-site feature coverage gate reports incomplete coverage because unrelated browser scenarios were not run.
- Changed JavaScript passes ESLint. OpenSpec proposal validates with `--strict`.
