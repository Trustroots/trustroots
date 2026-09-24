# Package manager evaluation

The pnpm lockfile in this branch is a candidate generated from the committed
npm lockfile. npm remains the supported package manager while the candidate is
evaluated.

Run scripts/benchmark-package-managers.sh from a disposable checkout on
Node.js 24, npm 11.17.0, and pnpm 11.25.0. The script archives the committed
HEAD into a fresh temporary directory for each install, then repeats with a
warm cache or store. Uncommitted changes are not measured. Record the operating
system, runtime versions, and full output alongside the decision. Check pnpm's
output for ignored dependency build scripts: a successful install with skipped
native builds is not equivalent to npm's install. Approve the required builds
explicitly and rerun the comparison before drawing a performance conclusion.

Repeat the comparison in both development and production container builds.
Review strict dependency resolution failures, the pinned Git dependency, and
native modules (sharp, canvas, gm, and the file-magic fallback) before
proposing a package-manager switch. The current draft does not update CI,
Dockerfiles, deployment scripts, contributor setup, or the supported
packageManager field.
