#!/usr/bin/env bash
set -euo pipefail

image="${1:?Usage: check-production-startup.sh IMAGE}"
prefix="trustroots-startup-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
version="${TRUSTROOTS_CI_MONGO_VERSION:-4.4}"
mongo_image="public.ecr.aws/docker/library/mongo:$version"
mongo_shell=mongosh
if [ "$version" = 4.4 ]; then
  mongo_shell=mongo
fi
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
if ! docker image inspect "$mongo_image" >/dev/null 2>&1 \
  && ! docker pull "$mongo_image"; then
  docker pull "mongo:$version"
  docker tag "mongo:$version" "$mongo_image"
fi
docker network create --internal "$network" >/dev/null
docker run -d --name "$mongo" --network "$network" --network-alias mongodb \
  "$mongo_image" --bind_ip_all --wiredTigerCacheSizeGB 0.25 >/dev/null
ready=false
for attempt in {1..60}; do
  if docker exec "$mongo" "$mongo_shell" --quiet --eval 'quit(db.adminCommand({ping: 1}).ok ? 0 : 1)' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done
[ "$ready" = true ]

# Fixture values for the disposable deployment.
mfa_key="$(printf '%032d' 0 | base64)"
docker run -d --name "$web" --network "$network" \
  -e DB_1_PORT_27017_TCP_ADDR=mongodb -e TRUSTROOTS_SKIP_LOCAL_CONFIG=true \
  -e MFA_ENCRYPTION_KEY="$mfa_key" -e TRUSTROOTS_PASSKEY_RP_ID=trustroots.test \
  -e TRUSTROOTS_PASSKEY_ORIGINS=https://trustroots.test,https://www.trustroots.test \
  "$image" >/dev/null
docker run -d --name "$worker" --network "$network" \
  -e NODE_ENV=production -e DB_1_PORT_27017_TCP_ADDR=mongodb \
  -e TRUSTROOTS_SKIP_LOCAL_CONFIG=true -e MFA_ENCRYPTION_KEY="$mfa_key" \
  "$image" node worker.mjs >/dev/null

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

# A signed Android build needs a direct JSON response from the production server.
docker exec "$web" curl --fail --silent --max-time 3 \
  --write-out '\n%{http_code} %{content_type}' \
  http://127.0.0.1/.well-known/assetlinks.json |
  docker exec -i "$web" node -e '
    const assert = require("assert");
    const fs = require("fs");
    const response = fs.readFileSync(0, "utf8");
    const lastNewline = response.lastIndexOf("\n");
    assert.match(response.slice(lastNewline + 1), /^200 application\/json(?:;|$)/);
    assert.deepStrictEqual(
      JSON.parse(response.slice(0, lastNewline)),
      JSON.parse(fs.readFileSync("public/.well-known/assetlinks.json", "utf8")),
    );
  '

# Confirm development tooling was removed while application dependencies remain
# available in the runtime image.
docker run --rm --entrypoint node "$image" -e '
  const assert = require("assert");
  for (const dependency of ["jest", "webpack", "nodemon"]) {
    assert.throws(
      () => require.resolve(dependency),
      error => error.code === "MODULE_NOT_FOUND",
      `${dependency} should be omitted from the production image`,
    );
  }
  for (const dependency of ["express", "file-type", "semver"]) {
    require.resolve(dependency);
  }
  const sharp = require("sharp");
  if (typeof sharp !== "function" || !sharp.versions || !sharp.versions.vips) {
    throw new Error("sharp native binding did not load");
  }
  console.log("Production dependencies present; representative build tools omitted.");
'

# Check the executable and authentication environment of the actual processes.
for container in "$web" "$worker"; do
  # /proc executable links require the target process UID in unprivileged Docker.
  process_user=root
  if [ "$container" = "$web" ]; then
    process_user=app
  fi
  docker exec --user "$process_user" "$container" node -e '
    const fs = require("fs");
    const cp = require("child_process");
    const authVariables = ["MFA_ENCRYPTION_KEY"];
    if (process.argv[1] === "app") {
      authVariables.push("TRUSTROOTS_PASSKEY_RP_ID", "TRUSTROOTS_PASSKEY_ORIGINS");
    }
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
      const environment = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
      for (const variable of authVariables) {
        if (!process.env[variable] || !environment.includes(`${variable}=${process.env[variable]}`)) {
          throw new Error(`Application process did not receive ${variable}`);
        }
      }
      console.log(`Application PID ${pid}: ${version}`);
    }
  ' "$process_user"
done
# Exercise the upload detector in the running production image as app.
docker exec --user app "$web" node -e '
  const assert = require("assert");
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "trustroots-file-type-"));
  const fixture = path.join(directory, "pixel.png");
  (async () => {
    const {fileTypeFromFile} = await import("file-type");
    fs.writeFileSync(fixture, Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=",
      "base64",
    ));
    const result = await fileTypeFromFile(fixture);
    assert.strictEqual(result.mime, "image/png");
    console.log("Production file-type detection passed.");
  })().catch(error => {
    console.error(error);
    process.exitCode = 1;
  }).finally(() => fs.rmSync(directory, {recursive: true, force: true}));
'
printf 'Passenger application, worker startup and file-type detection passed.\n'
