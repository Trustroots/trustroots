#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV=production
export TRUSTROOTS_SKIP_LOCAL_CONFIG=true
export TRUSTROOTS_WEBPACK_SKIP_ESLINT=true

exec webpack --config config/webpack/webpack.config.js
