#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV=production
export TRUSTROOTS_SKIP_LOCAL_CONFIG=true

exec vite build --config vite.config.mjs
