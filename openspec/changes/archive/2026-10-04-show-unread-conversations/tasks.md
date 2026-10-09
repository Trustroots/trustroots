## Implementation

- [x] Filter inbox results to unread conversations when requested.
- [x] Add an unread view to the inbox and preserve the filter across pages.
- [x] Search member names, usernames, and latest message previews across inbox
      pages.
- [x] Add server, client, and end-to-end regression coverage.
- [x] Update the living messaging spec and archive this change after verification.

## Verification

- OpenSpec change validates with `--strict`.
- Focused inbox client suite: 14 passing with 100% statement, branch, function,
  and line coverage for the changed component.
- TypeScript checks, changed-file ESLint, feature manifest validation, and
  Playwright test discovery pass.
- Server and browser tests require MongoDB, which is unavailable in this
  workspace; the new regression cases are ready to run in CI.
