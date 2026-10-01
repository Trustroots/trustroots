## Implementation

- [x] Allow administrators to remove the shadowban role without running add-only side effects.
- [x] Add a confirmed Unshadowban action to shadowbanned member reports.
- [x] Add server, client, and end-to-end coverage; keep the changed admin client component fully covered.
- [x] Update the living admin moderation spec and archive this change after verification.

## Verification

- Full server suite: 1,784 passing, 22 pending; 100% statements, branches, functions, and lines.
- Focused admin client suite: 27 passing; the changed admin component has 100% line, branch, and function coverage.
- Focused admin browser suite: 5 passing, including preservation of hidden past messages.
- Full client suite: 1,387 passing; 100% statements, branches, functions, and lines.
- `scripts/coverage/check-coverage.js --require-full` passed for both client and server.
- Changed JavaScript passes ESLint; this OpenSpec change validates with `--strict`.
