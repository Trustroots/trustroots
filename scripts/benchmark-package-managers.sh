#!/usr/bin/env bash

set -euo pipefail

if [[ ! -f package-lock.json ]]; then
  echo 'Run this script from a checkout containing the npm lockfile.' >&2
  exit 2
fi

version_hint() {
  echo 'Use Node.js 24, npm 11.17.0, and pnpm 11.25.0 for comparable lockfile installs.' >&2
  echo 'With Node 24 active, install isolated tools and add them to PATH:' >&2
  echo '  npm install --prefix /tmp/trustroots-pm-tools --no-save --ignore-scripts npm@11.17.0 pnpm@11.25.0' >&2
  echo '  export PATH=/tmp/trustroots-pm-tools/node_modules/.bin:$PATH' >&2
}

if ! node_version=$(node --version) || ! npm_version=$(npm --version) || ! pnpm_version=$(pnpm --pm-on-fail=ignore --version); then
  version_hint
  exit 2
fi
echo "Node: $node_version"
echo "npm: $npm_version"
echo "pnpm: $pnpm_version"

if [[ ! "$node_version" =~ ^v24\. || "$npm_version" != '11.17.0' || "$pnpm_version" != '11.25.0' ]]; then
  version_hint
  exit 2
fi

report_dir=${1:-"tmp/package-manager-benchmark-$(date -u +%Y%m%dT%H%M%SZ)"}
mkdir -p "$report_dir"
report_dir=$(cd "$report_dir" && pwd)
exec > >(tee "$report_dir/install.log") 2>&1

echo "Operating system: $(uname -srm)"
echo "Node: $node_version; npm: $npm_version; pnpm: $pnpm_version"
echo "Source commit: $(git rev-parse HEAD)"
echo "Full output: $report_dir/install.log"

benchmark_dir=$(mktemp -d "${TMPDIR:-/tmp}/trustroots-package-manager.XXXXXX")
trap 'rm -rf "$benchmark_dir"' EXIT

# Generate the candidate from this exact committed npm lockfile, rather than
# maintaining a second lockfile that becomes stale on dependency updates.
mkdir -p "$benchmark_dir/source"
git archive HEAD | tar -x -C "$benchmark_dir/source"
(cd "$benchmark_dir/source" && pnpm --pm-on-fail=ignore import)
cp "$benchmark_dir/source/pnpm-lock.yaml" "$report_dir/pnpm-lock.yaml"

measure() {
  local label=$1
  shift
  local checkout="$benchmark_dir/$label"
  mkdir -p "$checkout" || return 1
  if ! cp -R "$benchmark_dir/source/." "$checkout/"; then
    echo "$label: could not prepare a fresh checkout" >&2
    return 1
  fi

  local started=$SECONDS
  local status=0
  if (cd "$checkout" && "$@"); then
    printf '%s: %s seconds (success)\n' "$label" "$((SECONDS - started))"
  else
    status=$?
    printf '%s: %s seconds (failed with exit %s)\n' \
      "$label" "$((SECONDS - started))" "$status"
  fi
  rm -rf -- "$checkout"
  return "$status"
}

echo 'npm clean install and warm-cache repeat'
overall_status=0
measure npm-cold env HUSKY=0 npm ci --cache="$benchmark_dir/npm-cache" --no-audit --no-fund || overall_status=1
measure npm-warm env HUSKY=0 npm ci --cache="$benchmark_dir/npm-cache" --no-audit --no-fund || overall_status=1

echo 'pnpm clean install and warm-store repeat'
measure pnpm-cold env HUSKY=0 pnpm --pm-on-fail=ignore install --frozen-lockfile --store-dir="$benchmark_dir/pnpm-store" || overall_status=1
measure pnpm-warm env HUSKY=0 pnpm --pm-on-fail=ignore install --frozen-lockfile --store-dir="$benchmark_dir/pnpm-store" || overall_status=1

exit "$overall_status"
