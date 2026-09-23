#!/usr/bin/env bash
set -euo pipefail

image="${1:?Usage: check-production-startup.sh IMAGE}"
prefix="trustroots-startup-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
network="$prefix"
mongo="$prefix-mongo"
web="$prefix-web"
worker="$prefix-worker"

cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then
    docker logs "$web" 2>&1 || true
    docker logs "$worker" 2>&1 || true
    docker logs "$mongo" 2>&1 || true
  fi
  docker rm -f "$web" "$worker" "$mongo" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  exit "$result"
}
trap cleanup EXIT

# Empty, disposable database; no production configuration or external services.
docker network create --internal "$network" >/dev/null
docker run -d --name "$mongo" --network "$network" --network-alias mongodb \
  mongo:4.4 --bind_ip_all --wiredTigerCacheSizeGB 0.25 >/dev/null
ready=false
for attempt in {1..60}; do
  if docker exec "$mongo" mongo --quiet --eval 'quit(db.adminCommand({ping: 1}).ok ? 0 : 1)' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
[ "$ready" = true ]

docker run -d --name "$web" --network "$network" \
  -e DB_1_PORT_27017_TCP_ADDR=mongodb -e TRUSTROOTS_SKIP_LOCAL_CONFIG=true \
  "$image" >/dev/null
docker run -d --name "$worker" --network "$network" \
  -e NODE_ENV=production -e DB_1_PORT_27017_TCP_ADDR=mongodb \
  -e TRUSTROOTS_SKIP_LOCAL_CONFIG=true "$image" node worker.js >/dev/null

ready=false
for attempt in {1..60}; do
  # Use an Express endpoint so a static nginx response cannot pass the check.
  if docker exec "$web" curl --fail --silent --max-time 3 http://127.0.0.1/api/languages >/dev/null \
    && docker logs "$web" 2>&1 | grep -Eq 'Phusion Passenger:.*on' \
    && docker logs "$worker" 2>&1 | grep -Fq '[Worker] Agenda started processing background jobs'; then
    ready=true
    break
  fi
  sleep 2
done
[ "$ready" = true ]

# Check the executable of the actual application/worker process, not PATH's node.
for container in "$web" "$worker"; do
  # /proc executable links require the target process UID in unprivileged Docker.
  process_user=root
  if [ "$container" = "$web" ]; then
    process_user=app
  fi
  docker exec --user "$process_user" "$container" node -e '
    const fs = require("fs");
    const cp = require("child_process");
    const matches = fs.readdirSync("/proc").filter(p => /^\d+$/.test(p)).filter(p => {
      if (+p === process.pid) return false;
      try {
        // Passenger may rewrite the process title, so identify the executable
        // and application directory instead of relying on command-line text.
        return /\/node$/.test(fs.readlinkSync(`/proc/${p}/exe`)) &&
          fs.readlinkSync(`/proc/${p}/cwd`) === "/home/app/trustroots";
      } catch { return false; }
    });
    if (!matches.length) throw new Error("Application process not found");
    for (const pid of matches) {
      const version = cp.execFileSync(`/proc/${pid}/exe`, ["--version"], {encoding: "utf8"}).trim();
      if (!/^v24\./.test(version)) throw new Error(`Unexpected runtime: ${version}`);
      console.log(`Application PID ${pid}: ${version}`);
    }
  '
done
printf 'Passenger application and worker startup passed.\n'
