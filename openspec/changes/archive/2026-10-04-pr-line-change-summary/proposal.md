# Pull request line-change summary

## Why

Total diff size hides whether a pull request simplifies application code or adds
test coverage. Reviewers need separate addition, removal and net counts.

## What Changes

- Add a line-change table to the existing updated CI comment for each PR.
- Split application code, tests and fixtures, documentation/configuration/other,
  and generated files/lockfiles; keep binary files outside line totals.
- Mark application-code reductions and test growth green, the opposite direction
  yellow, and unchanged or neutral groups white. Yellow is informational.
- Compare the current PR head against its merge base, and retain coverage results
  for code PRs without inventing coverage results for documentation-only PRs.
- Provide a main-branch dispatch workflow to backfill open PRs below a selected
  number, preserving coverage content and executing only trusted report tooling.
- Refresh fork and older PR reports using trusted main-branch code; fetched PR
  files are diff data and are never checked out or executed by that report job.

## Impact

- Affects coverage-summary tooling and the Tests workflow.
- No application behaviour or coverage threshold changes.
- Use unit and Git-backed CLI integration tests; browser E2E tests do not exercise
  this CI-only report.
