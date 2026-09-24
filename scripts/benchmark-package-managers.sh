#!/usr/bin/env bash

set -u

if [[ ! -f package-lock.json || ! -f pnpm-lock.yaml ]]; then
  echo 'Run this script from a checkout containing both lockfiles.' >&2
  exit 2
fi

benchmark_dir=$(mktemp -d "${TMPDIR:-/tmp}/trustroots-package-manager.XXXXXX")
trap 'rm -rf "$benchmark_dir"' EXIT

echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo "pnpm: $(pnpm --version)"

if [[ "$(npm --version)" != '11.17.0' || "$(pnpm --version)" != '11.25.0' ]]; then
  echo 'Use npm 11.17.0 and pnpm 11.25.0 for comparable lockfile installs.' >&2
  exit 2
fi

measure() {
  local label=$1
  shift
  local started=$SECONDS
  if "$@"; then
    printf '%s: %s seconds (success)\n' "$label" "$((SECONDS - started))"
  else
    local status=$?
    printf '%s: %s seconds (failed with exit %s)\n' \
      "$label" "$((SECONDS - started))" "$status"
  fi
}

echo 'npm clean install and warm-cache repeat'
measure 'npm cold' env HUSKY=0 npm ci --cache="$benchmark_dir/npm-cache" --no-audit --no-fund
measure 'npm warm' env HUSKY=0 npm ci --cache="$benchmark_dir/npm-cache" --no-audit --no-fund

echo 'pnpm clean install and warm-store repeat'
measure 'pnpm cold' pnpm install --frozen-lockfile --store-dir="$benchmark_dir/pnpm-store"
measure 'pnpm warm' pnpm install --frozen-lockfile --store-dir="$benchmark_dir/pnpm-store"
