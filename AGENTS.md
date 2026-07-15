This is the canonical AI coding guideline file for this repository. Keep other
assistant-specific files, such as `.cursorrules` and `CLAUDE.md`, as short
pointers back to this file so the project guidance does not drift.

This project is under active development again (no longer in maintenance mode),
so improvements, refactors, and cleanups are welcome where they add value.

Use OpenSpec for new functionality, breaking behaviour changes, and material
architectural changes. Create and validate a proposal in `openspec/changes/`
before implementation, then archive it and update the relevant living specs in
`openspec/specs/` when the work is complete. Small bug fixes, formatting,
comments, configuration-only changes, and non-breaking dependency updates do
not require a proposal.

Keep test fixtures, regression cases, and example payloads anonymous. When
turning a public bug report or security disclosure (including a GitHub issue)
into a test, preserve only what is needed to reproduce the behaviour and
replace names, usernames, email addresses, locations, IDs, message content,
and other identifying data with fictional values.

Prefer git worktrees for parallel, exploratory, or potentially disruptive work.

Both server and client test coverage are currently at 100%; keep them at this
level. Do not lower coverage thresholds or baselines without a clear reason.

Try not to reduce the number of end-to-end tests. The current baseline on main
is 167 e2e tests; if removing one, replace it with equivalent coverage unless
there is an explicit reason not to.

When adding new functionality, add at least one end-to-end test for it unless
there is a clear reason that e2e coverage is not appropriate.

Use British spelling for any new text (for example decentralisation, organisation,
licence, emphasise). Do not change US spellings in code identifiers, CSS
properties, URLs, or third-party names.
