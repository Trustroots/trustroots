# Pull request dependency summaries

## Why

Line totals hide dependency removals and version changes. Reviewers need an inventory alongside the existing automated line-change table, including changes like the asset-loader removal in PR #3074.

## What Changes

- Report additions, removals, changes and net counts for direct runtime/development dependencies and resolved lockfile entries.
- List changed declarations and resolved versions in a collapsible detail section.
- Compare the same merge base and head used by the line-change report, including fork and backfill reports, without executing PR code.
- Explain that lockfile counts include duplicate installed paths and do not measure production Docker pruning.
- Collect an inventory from the actual built production image after pruning, publish it as an artifact, and show installed and unique package counts in the overview. Mark unavailable inventories explicitly.

## Impact

Only trusted CI reporting scripts, their tests and the developer-tooling specification change. No member-facing behaviour, database migration or deployment ordering is involved. Browser e2e tests are unsuitable for a Git/JSON report; fixture repositories exercise the reporting path instead. Coverage requirements remain unchanged.
