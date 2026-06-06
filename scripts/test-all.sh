#!/usr/bin/env bash
set -euo pipefail

client_status=0
server_status=0

npm run test:coverage:client &
client_pid=$!

npm run test:coverage:server:codex &
server_pid=$!

if ! wait "$client_pid"; then
  client_status=1
fi

if ! wait "$server_pid"; then
  server_status=1
fi

if [ "$client_status" -ne 0 ] || [ "$server_status" -ne 0 ]; then
  exit 1
fi

check_client_status=0
check_server_status=0

npm run coverage:check -- --scope=client &
check_client_pid=$!

npm run coverage:check -- --scope=server &
check_server_pid=$!

if ! wait "$check_client_pid"; then
  check_client_status=1
fi

if ! wait "$check_server_pid"; then
  check_server_status=1
fi

if [ "$check_client_status" -ne 0 ] || [ "$check_server_status" -ne 0 ]; then
  exit 1
fi

npm run test:e2e
npm run coverage:report
