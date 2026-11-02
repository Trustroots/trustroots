# Semgrep checks

The Semgrep workflow runs Community Edition without an account or token. It uses
the Node.js, Express and React registry rulesets plus the local database-filter
rule. It does not enable the Semgrep Secrets product. Metrics and version checks
are disabled.
Registry rules are downloaded at scan time; the scanner image is pinned by digest.
Update its version and digest together when upgrading it.

Pull requests compare with the target commit and fail on new findings. Pushes to
`main`, weekly Monday scans at 06:41 UTC, and manual runs report all findings without
failing for existing findings. Scanner execution and configuration errors still
fail the job. Results go to GitHub code scanning under the `semgrep` category.
Make the Semgrep job a required status check in the repository ruleset to enforce
the PR gate. No automatic issue creation or PR comments are configured.

The workflow explicitly passes tracked JavaScript and TypeScript files, including
`.mts` and `.cts`, because default language discovery skips these extensions.
Semgrep's normal ignore rules still apply. The local rule fixtures are excluded
from the application scan and run separately using `semgrep scan --test`.

The local rule follows request body, query and parameter values into common
database-filter methods. Explicit conversion to a string or number ends that
object flow. This is a conservative local check: it cannot infer every schema
validator or distinguish every unrelated object with a method named `find`.
Review findings in context. Do not add blanket exclusions for modules or entire
rule families to resolve individual false positives.

Community Edition does not provide whole-application data-flow analysis. Parser
warnings can also leave parts of files unanalysed; inspect warnings when reviewing
the first scan and scanner upgrades. Request/browser regression tests and CodeQL
provide complementary coverage.

To reproduce the scan, use the pinned image from `.github/workflows/semgrep.yml`
with the same arguments. Mount the repository at its absolute host path if using
a Git worktree, so Git can resolve the worktree's metadata. For just the local
rules:

```sh
semgrep scan --test tooling/semgrep/rules
```
