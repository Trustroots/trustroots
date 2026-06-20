#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${TRUSTROOTS_CODEX_MONGO_CONTAINER:-trustroots-codex-mongo}"
MONGO_IMAGE="${TRUSTROOTS_CODEX_MONGO_IMAGE:-mongo:4.4}"
MONGO_HOST="${DB_1_PORT_27017_TCP_ADDR:-127.0.0.1}"
MONGO_URI="${TRUSTROOTS_CODEX_MONGO_URI:-mongodb://${MONGO_HOST}:27017/trustroots-test}"
GULP_BIN="${TRUSTROOTS_GULP_BIN:-./node_modules/.bin/gulp}"
STARTED_CONTAINER=0
TEST_FILE_LIST=""
MONGO_PING_ERROR=""
DOCKER_ERROR=""
CODEX_NETWORK_MESSAGE="Codex network access is required to reach local MongoDB. Request network permission, then rerun."

can_ping_mongo() {
  local output

  if output="$(MONGO_URI="$MONGO_URI" node <<'NODE' 2>&1
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;

(async () => {
  const client = await MongoClient.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await client.db().command({ ping: 1 });
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

  if command -v mongosh >/dev/null 2>&1; then
    if output="$(MONGOSH_LOG_DIR="${TMPDIR:-/tmp}" mongosh --quiet "$MONGO_URI" \
      --eval 'db.runCommand({ ping: 1 }).ok' 2>&1)"; then
      return 0
    fi
  fi

  MONGO_PING_ERROR="$output"
  return 1
}

has_codex_network_denial() {
  printf '%s' "$1" | grep -Eiq \
    'connect EPERM|operation not permitted|permission denied while trying to connect to the Docker daemon socket'
}

print_codex_network_denial() {
  echo "$CODEX_NETWORK_MESSAGE" >&2
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
  if [ -n "$TEST_FILE_LIST" ]; then
    rm -f "$TEST_FILE_LIST"
  fi
}
trap cleanup EXIT

if ! can_ping_mongo; then
  if has_codex_network_denial "$MONGO_PING_ERROR"; then
    print_codex_network_denial
    exit 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "MongoDB is not reachable at $MONGO_URI and Docker is not installed." >&2
    exit 1
  fi

  if ! container_names="$(docker_container_names)"; then
    if has_codex_network_denial "$DOCKER_ERROR"; then
      print_codex_network_denial
      exit 1
    fi

    echo "$DOCKER_ERROR" >&2
    exit 1
  fi

  if ! printf '%s\n' "$container_names" | grep -qx "$CONTAINER_NAME"; then
    if ! start_mongo_container; then
      if has_codex_network_denial "$DOCKER_ERROR"; then
        print_codex_network_denial
        exit 1
      fi

      echo "$DOCKER_ERROR" >&2
      exit 1
    fi
  fi

  for _ in $(seq 1 40); do
    if can_ping_mongo; then
      break
    fi
    sleep 0.5
  done
fi

if ! can_ping_mongo; then
  if has_codex_network_denial "$MONGO_PING_ERROR"; then
    print_codex_network_denial
    exit 1
  fi

  echo "MongoDB did not become reachable at $MONGO_URI." >&2
  exit 1
fi

if [ ! -x "$GULP_BIN" ]; then
  GULP_BIN="gulp"
fi

run_server_tests() {
  NODE_ENV=test \
    DB_1_PORT_27017_TCP_ADDR="$MONGO_HOST" \
    SERVER_TEST_FILES="$1" \
    TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK=true \
    TRUSTROOTS_FILE_MAGIC_FALLBACK=true \
    "$GULP_BIN" test:server
}

run_server_tests_with_retry() {
  local test_file="$1"

  if run_server_tests "$test_file"; then
    return 0
  fi

  echo "Retrying $test_file once after a failed isolated run." >&2
  run_server_tests "$test_file"
}

if [ "${TRUSTROOTS_CODEX_ISOLATED_SERVER_TESTS:-false}" != "true" ]; then
  run_server_tests ""
else
  TEST_FILE_LIST="$(mktemp "${TMPDIR:-/tmp}/trustroots-server-tests.XXXXXX")"

  find modules -path '*/tests/server/*.js' \
    ! -path 'modules/core/tests/server/worker.tests.js' \
    ! -path 'modules/core/tests/server/jobs/send-push-message.server.job.tests.js' \
    -print | sort >"$TEST_FILE_LIST"

  TEST_COUNT="$(wc -l <"$TEST_FILE_LIST" | tr -d ' ')"
  echo "Running $TEST_COUNT server test files in isolated mode (TRUSTROOTS_CODEX_ISOLATED_SERVER_TESTS=true)."

  while IFS= read -r test_file; do
    echo "==> $test_file"
    run_server_tests_with_retry "$test_file"
  done <"$TEST_FILE_LIST"
fi
