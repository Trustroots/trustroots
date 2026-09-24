#!/usr/bin/env bash

set -euo pipefail

if [[ ! -f package-lock.json || ! -f pnpm-lock.yaml ]]; then
  echo 'Run this script from a checkout containing both lockfiles.' >&2
  exit 2
fi

benchmark_dir=$(mktemp -d "${TMPDIR:-/tmp}/trustroots-package-manager.XXXXXX")
trap 'rm -rf "$benchmark_dir"' EXIT

node_version=$(node --version)
npm_version=$(npm --version)
pnpm_version=$(pnpm --version)
echo "Node: $node_version"
echo "npm: $npm_version"
echo "pnpm: $pnpm_version"

if [[ ! "$node_version" =~ ^v24\. || "$npm_version" != '11.17.0' || "$pnpm_version" != '11.25.0' ]]; then
  echo 'Use Node.js 24, npm 11.17.0, and pnpm 11.25.0 for comparable lockfile installs.' >&2
  exit 2
fi

measure() {
  local label=$1
  shift
  local checkout="$benchmark_dir/$label"
  mkdir -p "$checkout" || return 1
  if ! git archive HEAD | tar -x -C "$checkout"; then
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
measure pnpm-cold env HUSKY=0 pnpm install --frozen-lockfile --store-dir="$benchmark_dir/pnpm-store" || overall_status=1
measure pnpm-warm env HUSKY=0 pnpm install --frozen-lockfile --store-dir="$benchmark_dir/pnpm-store" || overall_status=1

exit "$overall_status"
