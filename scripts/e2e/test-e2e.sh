#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${TRUSTROOTS_E2E_MONGO_CONTAINER:-trustroots-e2e-mongo}"
MONGO_IMAGE="${TRUSTROOTS_E2E_MONGO_IMAGE:-mongo:4.4}"
MONGO_HOST="${DB_1_PORT_27017_TCP_ADDR:-127.0.0.1}"
MONGO_URI="${TRUSTROOTS_E2E_MONGO_URI:-mongodb://${MONGO_HOST}:27017/trustroots-test}"
STATUS_PATH="${TRUSTROOTS_E2E_STATUS_PATH:-coverage/e2e/status.json}"
STARTED_CONTAINER=0
MONGO_ERROR=""
DOCKER_ERROR=""
PLAYWRIGHT_ERROR=""

export TRUSTROOTS_E2E_WEB_PORT="${TRUSTROOTS_E2E_WEB_PORT:-4300}"
export TRUSTROOTS_E2E_API_PORT="${TRUSTROOTS_E2E_API_PORT:-4301}"
export TRUSTROOTS_E2E_REUSE_SERVER="${TRUSTROOTS_E2E_REUSE_SERVER:-false}"

if [ "${CI:-}" = "true" ]; then
  if [ -z "${HOME:-}" ] || [ "$HOME" = "/root" ]; then
    export HOME="$PWD/tmp/ci-home"
  fi

  export npm_config_cache="${npm_config_cache:-$PWD/tmp/npm-cache}"
  export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$PWD/tmp/ci-cache}"

  if [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
    if [ -d /home/app/ms-playwright ]; then
      export PLAYWRIGHT_BROWSERS_PATH=/home/app/ms-playwright
    else
      export PLAYWRIGHT_BROWSERS_PATH="$PWD/tmp/ms-playwright"
    fi
  fi

  mkdir -p "$HOME" "$npm_config_cache" "$XDG_CACHE_HOME" "$PLAYWRIGHT_BROWSERS_PATH"
fi

if [ -z "${TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER:-}" ]; then
  if [ "${CI:-}" = "true" ]; then
    export TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER=false
  else
    export TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER=true
  fi
fi

NODE_MAJOR="$(node -e "console.log(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -ge 17 ]; then
  case " ${NODE_OPTIONS:-} " in
    *" --openssl-legacy-provider "*) ;;
    *) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--openssl-legacy-provider" ;;
  esac
fi

write_status() {
  local status="$1"
  local exit_code="$2"
  local message="$3"

  STATUS="$status" \
  EXIT_CODE="$exit_code" \
  MESSAGE="$message" \
  node ./scripts/e2e/summarize-results.js
}

generate_coverage_report() {
  if [ "${TRUSTROOTS_E2E_SKIP_COVERAGE_REPORT:-false}" = "true" ]; then
    return 0
  fi

  node ./scripts/coverage/generate-report.js >/dev/null 2>&1 || true
}

exit_with_status() {
  local status="$1"
  local exit_code="$2"
  local message="$3"

  write_status "$status" "$exit_code" "$message"
  generate_coverage_report
  exit "$exit_code"
}

mongo_eval() {
  local mode="$1"
  local output

  if output="$(MONGO_URI="$MONGO_URI" MONGO_MODE="$mode" node <<'NODE' 2>&1
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const mode = process.env.MONGO_MODE;

(async () => {
  const client = await MongoClient.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const db = client.db();
    if (mode === 'drop') {
      await db.dropDatabase();
    } else {
      await db.command({ ping: 1 });
    }
  } finally {
    await client.close();
  }
})().catch(error => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
NODE
)"; then
    return 0
  fi

  MONGO_ERROR="$output"
  return 1
}

ensure_playwright_browser() {
  local output

  if [ -n "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]; then
    if [ -x "$PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH" ]; then
      return 0
    fi

    PLAYWRIGHT_ERROR="PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is set but is not executable: $PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"
    return 1
  fi

  # Install the Chromium build bundled with the installed @playwright/test
  # version. This keeps the browser binary in sync with Playwright and avoids
  # relying on a manually installed system Chrome. Wrap the install in a timeout
  # so automation records a blocked status instead of hanging indefinitely.
  if output="$(node <<'NODE' 2>&1
const { spawnSync } = require('child_process');

const timeout = Number(process.env.TRUSTROOTS_PLAYWRIGHT_INSTALL_TIMEOUT_MS) || 120000;
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['playwright', 'install', 'chromium'],
  {
    encoding: 'utf8',
    timeout,
  },
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  console.error(result.error.message);
  process.exit(result.error.code === 'ETIMEDOUT' ? 124 : 1);
}

process.exit(result.status === null ? 1 : result.status);
NODE
)"; then
    return 0
  fi

  PLAYWRIGHT_ERROR="$output"

  for browser_path in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  do
    if [ -x "$browser_path" ]; then
      export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$browser_path"
      return 0
    fi
  done

  return 1
}

has_codex_network_denial() {
  printf '%s' "$1" | grep -Eiq \
    'connect EPERM|operation not permitted|permission denied while trying to connect to the Docker daemon socket'
}

docker_container_names() {
  local output

  if output="$(docker ps --format '{{.Names}}' 2>&1)"; then
    printf '%s\n' "$output"
    return 0
  fi

  DOCKER_ERROR="$output"
  return 1
}

start_mongo_container() {
  local output

  if output="$(docker run --detach --rm \
    --name "$CONTAINER_NAME" \
    --publish 127.0.0.1:27017:27017 \
    --tmpfs /data/db:rw,size=512m \
    "$MONGO_IMAGE" 2>&1)"; then
    STARTED_CONTAINER=1
    return 0
  fi

  DOCKER_ERROR="$output"
  return 1
}

cleanup() {
  if [ "$STARTED_CONTAINER" = "1" ]; then
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! mongo_eval ping; then
  if has_codex_network_denial "$MONGO_ERROR"; then
    echo "Network access is required to reach local MongoDB. Grant network permission, then rerun." >&2
    exit_with_status \
      "blocked" \
      1 \
      "End-to-end tests blocked by network permission while connecting to local MongoDB."
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "MongoDB is not reachable at $MONGO_URI and Docker is not installed." >&2
    exit_with_status \
      "blocked" \
      1 \
      "End-to-end tests blocked because MongoDB is not reachable and Docker is not installed."
  fi

  if ! container_names="$(docker_container_names)"; then
    if has_codex_network_denial "$DOCKER_ERROR"; then
      echo "Network access is required to reach Docker for the temporary MongoDB container." >&2
      exit_with_status \
        "blocked" \
        1 \
        "End-to-end tests blocked by network permission while connecting to Docker."
    fi

    echo "$DOCKER_ERROR" >&2
    exit_with_status \
      "blocked" \
      1 \
      "End-to-end tests blocked because Docker could not be reached."
  fi

  if ! printf '%s\n' "$container_names" | grep -qx "$CONTAINER_NAME"; then
    if ! start_mongo_container; then
      if has_codex_network_denial "$DOCKER_ERROR"; then
        echo "Network access is required to reach Docker for the temporary MongoDB container." >&2
        exit_with_status \
          "blocked" \
          1 \
          "End-to-end tests blocked by network permission while starting MongoDB in Docker."
      fi

      echo "$DOCKER_ERROR" >&2
      exit_with_status \
        "blocked" \
        1 \
        "End-to-end tests blocked because the temporary MongoDB container could not be started."
    fi
  fi

  for _ in $(seq 1 40); do
    if mongo_eval ping; then
      break
    fi
    sleep 0.5
  done
fi

if ! mongo_eval ping; then
  echo "MongoDB did not become reachable at $MONGO_URI." >&2
  echo "$MONGO_ERROR" >&2
  exit_with_status \
    "blocked" \
    1 \
    "End-to-end tests blocked because MongoDB did not become reachable."
fi

if ! ensure_playwright_browser; then
  if has_codex_network_denial "$PLAYWRIGHT_ERROR"; then
    echo "Network access is required to download the Playwright Chromium browser. Grant network permission, then rerun." >&2
    exit_with_status \
      "blocked" \
      1 \
      "End-to-end tests blocked by network permission while installing the Playwright Chromium browser."
  fi

  echo "$PLAYWRIGHT_ERROR" >&2
  exit_with_status \
    "blocked" \
    1 \
    "End-to-end tests blocked because the Playwright Chromium browser could not be installed."
fi

rm -rf coverage/e2e/js-raw coverage/e2e/captured-bundles

if ! mongo_eval drop; then
  echo "Failed to reset the e2e database at $MONGO_URI." >&2
  echo "$MONGO_ERROR" >&2
  exit_with_status \
    "blocked" \
    1 \
    "End-to-end tests blocked because the test database could not be reset."
fi

if ! NODE_ENV=test \
  DB_1_PORT_27017_TCP_ADDR="$MONGO_HOST" \
  TRUSTROOTS_SKIP_LOCAL_CONFIG=true \
  node ./scripts/e2e/seed.js; then
  exit_with_status \
    "blocked" \
    1 \
    "End-to-end tests blocked because the test database could not be seeded."
fi

if [ "${TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER:-false}" != "true" ]; then
  export TRUSTROOTS_E2E_USE_EXTRACTED_CSS=true

  if [ "${TRUSTROOTS_E2E_SKIP_WEB_BUILD:-false}" != "true" ]; then
    echo "Building client assets for end-to-end tests..."
    if ! npm run build:e2e; then
      exit_with_status \
        "blocked" \
        1 \
        "End-to-end tests blocked because the client bundle could not be built."
    fi
  fi
fi

set +e
NODE_ENV=test \
DB_1_PORT_27017_TCP_ADDR="$MONGO_HOST" \
TRUSTROOTS_SKIP_LOCAL_CONFIG=true \
TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK=true \
TRUSTROOTS_FILE_MAGIC_FALLBACK=true \
npx playwright test "$@"
playwright_status="$?"
set -e

set +e
if [ "$playwright_status" -eq 0 ]; then
  write_status "passed" 0 "End-to-end Playwright tests passed."
else
  write_status "failed" "$playwright_status" "End-to-end Playwright tests failed."
fi
summarize_status="$?"
set -e

generate_coverage_report

# Prefer the Playwright exit code when tests failed. Otherwise honour the
# summariser, which fails the run when required feature scenarios are missing.
if [ "$playwright_status" -ne 0 ]; then
  exit "$playwright_status"
fi

exit "$summarize_status"
