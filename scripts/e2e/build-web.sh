#!/usr/bin/env bash
set -euo pipefail

NODE_MAJOR="$(node -e "console.log(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -ge 17 ]; then
  case " ${NODE_OPTIONS:-} " in
    *" --openssl-legacy-provider "*) ;;
    *) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--openssl-legacy-provider" ;;
  esac
fi

export NODE_ENV=production
export TRUSTROOTS_SKIP_LOCAL_CONFIG=true
export TRUSTROOTS_WEBPACK_SKIP_ESLINT=true

exec webpack --config config/webpack/webpack.config.js
