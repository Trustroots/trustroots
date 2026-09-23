## Implementation

- [x] Define deprecated catalogue codes and expose their status in the languages array API.
- [x] Hide deprecated choices from profile picker search while retaining existing selections.
- [x] Reject newly added deprecated codes in profile updates while permitting unchanged values and removal.
- [x] Rename Limburgish in the catalogue generator and regenerate both outputs.
- [x] Add server, client, and end-to-end coverage; verify server and client coverage remains at 100%.
- [x] Update the living member profiles spec and archive this change.

## Verification

- Full client coverage: 274 suites and 1,565 tests passed; 100% statements, branches, functions, and lines.
- Full server coverage: 1,722 tests passed, 28 pending; 100% statements, branches, functions, and lines.
- Focused Playwright scenario and its two authentication setup tests passed. The whole-site scenario coverage gate reports incomplete coverage because only this scenario was selected.
- Changed JavaScript passes ESLint. OpenSpec proposal validates with `--strict`.
