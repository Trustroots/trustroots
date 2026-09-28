# Package manager evaluation

The benchmark generates a candidate pnpm lockfile from the committed npm
lockfile for each evaluation. A second lockfile is not maintained in the
repository. npm remains the supported package manager while the candidate is
evaluated.

Run scripts/benchmark-package-managers.sh from a disposable checkout on
Node.js 24, npm 11.17.0, and pnpm 11.25.0. With Node 24 active, install isolated
tool versions without changing the project's package manager:

```sh
npm install --prefix /tmp/trustroots-pm-tools --no-save --ignore-scripts npm@11.17.0 pnpm@11.25.0
export PATH=/tmp/trustroots-pm-tools/node_modules/.bin:$PATH
./scripts/benchmark-package-managers.sh
```

The script archives the committed HEAD, imports its npm lockfile, and copies
that snapshot into a fresh temporary directory for each install, then repeats
with a warm cache or store. Uncommitted changes are not measured. It saves the
generated lockfile, operating system, commit, runtime versions, timings, and
full output under `tmp/package-manager-benchmark-*`. Pass a report directory as
the first argument to choose another location. Keep that report alongside the
decision; failed installs also retain their output. Check both managers'
output for ignored dependency build scripts: a successful install with skipped
native builds does not prove application compatibility. Approve the required builds
explicitly and rerun the comparison before drawing a performance conclusion.

Candidate pnpm commands use `--pm-on-fail=ignore` to permit this one-off trial
in a project whose `packageManager` remains npm. The script checks pnpm's exact
version itself; it does not change that field or a global setting.

Repeat the comparison in both development and production container builds.
Review strict dependency resolution failures, the pinned Git dependency, and
native modules (sharp, canvas, gm, and the file-magic fallback) before
proposing a package-manager switch. The current draft does not update CI,
Dockerfiles, deployment scripts, contributor setup, or the supported
packageManager field.

## First local run: 28 September 2026

The source snapshot was `9a0d11a63410dc269c091da49681a6abdbca882f`, on
Darwin 25.6.0 arm64 with Node 24.21.0, npm 11.17.0 and pnpm 11.25.0.
The [full install output](benchmarks/package-manager-2026-09-28.txt) records
the generated candidate and all four attempts. Durations use whole seconds.

| Manager | Empty cache/store | Warm cache/store | Result                                        |
| ------- | ----------------- | ---------------- | --------------------------------------------- |
| npm     | 39 seconds        | 10 seconds       | Exit 0; five dependency build scripts skipped |
| pnpm    | 11 seconds        | 7 seconds        | Exit 1; ignored builds rejected               |

Both managers skipped build scripts for `canvas`, `core-js`, `core-js-pure`,
`styled-components` and `unrs-resolver`. npm reported these as pending script
approvals; pnpm failed with `ERR_PNPM_IGNORED_BUILDS`. The Husky prepare hook
also noted that the archived snapshots have no `.git` directory.

These are diagnostic timings, not a performance comparison of usable
installations. Approve and verify the necessary build scripts for both managers,
then rerun before drawing a performance conclusion. Native functionality and
both container comparisons remain outstanding. No package-manager switch is
recommended by this run.
