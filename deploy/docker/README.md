# Docker

This directory is the **single** local Docker setup for Trustroots (dev,
Mailpit, MongoDB, optional prod-like image test, data import, and production
image build).

> Production is **not** deployed from this `docker-compose.yml`. Production runs
> images built by `dockerBuild.sh` elsewhere.

## First-time setup

Create `data/local.js` (the `data/` directory is gitignored). It is mounted into
the app and must point the database at the `mongodb` Compose service and email
at the `mailpit` service:

```js
'use strict';

module.exports = {
  domain: 'localhost:8080',
  host: '0.0.0.0',
  db: {
    uri: 'mongodb://mongodb:27017/trustroots',
    checkCompatibility: false,
    autoIndex: true,
  },
  influxdb: {
    enabled: false,
  },
  mailer: {
    options: {
      jsonTransport: false,
      host: 'mailpit',
      port: 1025,
      ignoreTLS: true,
      auth: false,
      pool: true,
    },
  },
};
```

## Local development (default)

```bash
cd deploy/docker
docker compose up
```

- App with hot reload at http://localhost:3000 (webpack-dev-server; the API runs
  on :3001 inside the container).
- Mailpit UI at http://localhost:1080 (SMTP to `mailpit:1025` from the app).
- Runs `dev` + `mongodb` + `mailpit`; the repo is bind-mounted.
- Mailpit's UI is bound to localhost and its SMTP port is not published to the
  host. It runs on an internal-only Docker network with no outbound relay.
- Uses the `trustroots` database, so data imported via `importMongoData.sh` is
  visible.
- MongoDB data lives in the `trustroots_mongodb_data` Docker volume. This keeps
  WiredTiger on Docker's Linux filesystem instead of a host bind mount.
- MongoDB runs with a small WiredTiger cache so large imports can complete while
  the dev container is also running.

The first run builds the dev image (installs dependencies); this is slow once.

### After changing dependencies

`node_modules` lives in a named volume seeded from the image, so rebuild and
recreate it when `package.json` / `package-lock.json` change:

```bash
docker compose build dev
docker volume rm trustroots_node_modules   # if native modules misbehave after a rebuild
docker compose up -d -V --force-recreate dev
```

## Production-like image (optional)

To test the actual production image locally:

```bash
cd deploy/docker
docker compose --profile prod up --build
```

- Webapp at http://localhost:8080, plus the background `worker`.
- Assets are baked into the image at build time, so rebuild after changing code.
- This is only for local verification; it is not how production is deployed.

## Importing MongoDB data

With the stack running, import dumps into the `trustroots` database:

```bash
./fetchMongoDumps.sh      # fetch dumps (see script)
./importMongoData.sh      # restore into the mongodb service
```

If you previously ran this stack with `./data/mongodb` bind-mounted, recreate
MongoDB once so it starts on the Docker volume:

```bash
docker compose up -d --force-recreate mongodb
```

## Running tests

**Local:** use the devcontainer (recommended). Open with **Dev Containers: Reopen
in Container**, then run tests in the integrated terminal. MongoDB is already
available via compose. See [`.devcontainer/README.md`](../../.devcontainer/README.md).

```bash
npm run test:all
```

**CI:** GitHub Actions builds this dev image and runs tests via
`docker compose run dev` (see `docker-compose.ci.yml`).

After changing `package.json` / `package-lock.json`, rebuild the dev image:

```bash
cd deploy/docker
docker compose build dev
docker volume rm trustroots_node_modules   # if native modules misbehave
docker compose up -d -V --force-recreate dev
```

## Other profiles

- `--profile stats` — influxdb + grafana
- `--profile mongo-localhost` — expose mongodb on 127.0.0.1:27017

## Building the production image

GitHub Actions validates production image builds on pull requests and publishes
`linux/amd64` images tagged `latest` and `git-<short-commit>` to GHCR after
code-bearing pushes to `main`.

Production publishing requires the Actions variable `GHCR_PRODUCTION_USERNAME`
and secret `GHCR_PRODUCTION_TOKEN`. The token must be a classic personal access
token with `write:packages` and write access to `trustrootsops/trustroots`.

Build and push the production images:

```bash
./dockerBuild.sh
```

Then `docker push` the tags printed by the script. You need the relevant
permissions on the registry.

Alternatively, to build the production image directly from the repo root:

```bash
docker build \
  --build-arg "TRUSTROOTS_BUILD_COMMIT=$(git rev-parse HEAD)" \
  --build-arg "TRUSTROOTS_BUILD_COMMITTED_AT=$(git log -1 --format=%cI)" \
  --build-arg "TRUSTROOTS_BUILD_BRANCH=$(git rev-parse --abbrev-ref HEAD)" \
  -f ./production.Dockerfile . \
  -t ghcr.io/trustrootsops/trustroots:latest
```

## Production resilience

Application telemetry is best effort: statistics callbacks acknowledge local
validation, not InfluxDB persistence. Outstanding writes are capped at 32;
InfluxDB requests use a two-second timeout without retries. Daily statistics
jobs use the delivery-aware API. Lost telemetry is not replayed.

MongoDB, webapp and worker explicitly use Docker's rotated `local` logging driver
(three files of 10 MB per container). Read logs with `docker compose logs`.
Production hosts using a separate Compose file, such as
`/var/local/tr-deploy/compose.yml`, must apply this configuration there too,
replacing each service's existing logging block rather than inheriting a host
Loki driver:

```yaml
logging:
  driver: local
  options:
    max-size: '10m'
    max-file: '3'
```

Apply local logging to other services that inherit Loki logging too. Recreate
existing containers to apply the change; recreating MongoDB interrupts database
access and should be scheduled appropriately. This does not unblock containers
already stuck in the old driver. Recover Docker before recreating them. Logs
remain local and are not sent to Loki; no application image rebuild is needed. A separate Grafana Alloy collector
can ship Docker logs to Loki without coupling remote delivery to shutdown.

For HTTPS behind a trusted frontend proxy, the deployment-owned `local.js`
must specify `https: true`, the canonical `domain` (without a scheme), and
`sessionProxy: true`. The frontend must overwrite `X-Forwarded-Proto` and prevent
untrusted direct access to the app. Keep CSRF protection enabled.

### Require media storage at boot

Ensure `/etc/fstab` specifies the filesystem type, for example:

```text
/dev/disk/by-id/YOUR_MEDIA_VOLUME /mnt/media ext4 defaults 0 2
```

On a dedicated production Docker host, run `sudo systemctl edit docker.service`
and add:

```ini
[Unit]
RequiresMountsFor=/mnt/media
BindsTo=mnt-media.mount
After=mnt-media.mount
```

Then run `sudo systemctl daemon-reload`. This deliberately makes **all Docker
services on that host** depend on the media mount and stops Docker if systemd
observes the mount disappearing. Apply it during a maintenance window. Do not
restart Docker until the correct volume is mounted. Verify with
`findmnt /mnt/media`; never format an existing media volume to repair a mount.

### Checked deployments and rollback

Install Python 3.9 or newer and copy `production-deploy.py` to the deployment
host. Run as an operator with Docker access (or through `sudo`). The script
expects the existing `webapp`, `worker`, and `mongodb` services and the photo
bind mount at `/home/app/trustroots/public/uploads-profile`.

```bash
sudo python3 production-deploy.py preflight \
  --compose /var/local/tr-deploy/compose.yml \
  --media-mount /mnt/media --url https://www.trustroots.org
sudo python3 production-deploy.py deploy \
  --compose /var/local/tr-deploy/compose.yml \
  --media-mount /mnt/media --url https://www.trustroots.org
```

Deployment checks Compose configuration, required media storage, local logging,
HTTPS session settings and MongoDB connectivity before pulling. Use a dedicated
non-admin verification account with no personal data: the script prompts for
its username and password, checks readiness and a real login/session round trip,
and signs out. For automation supply `TRUSTROOTS_DEPLOY_USERNAME` and
`TRUSTROOTS_DEPLOY_PASSWORD` through the runner's secret environment; never put
the password in command-line arguments. Account rate limits still apply.

Local logging must include explicit positive `max-size` (an integer followed by
`k`, `m` or `g`) and `max-file` (an integer) options. Preflight also inspects all
existing webapp, worker and MongoDB containers, including stopped containers,
with a 15-second timeout per Docker inspection. Editing Compose does not change
existing containers' logging. If one still uses Loki or lacks explicit rotation
limits, deployment and rollback stop before pulling or replacing anything.
Migrate those containers separately during an agreed maintenance window, then
rerun preflight. A successful check does not migrate logging for you.

The script tags both previous image IDs with `<project>-<service>-rollback:previous`,
saves them in `.trustroots-previous-images.json` beside Compose, and uses immutable
IDs during replacement. It serialises invocations with a file lock and restores
previous images if replacement or verification fails. Rollback itself can fail
if Docker, storage, or the previous image is broken; inspect the result rather
than assuming recovery. Container replacement interrupts active work and does
not undo database migrations. Worker verification checks running state only.

Explicit rollback uses saved image IDs without pulling or needing a healthy
current application:

```bash
sudo python3 production-deploy.py rollback \
  --compose /var/local/tr-deploy/compose.yml \
  --media-mount /mnt/media --url https://www.trustroots.org
```

Do not run the old update script concurrently. These safeguards require adopting
the script and configuration on the production host; an image update alone does
not change mounts, logging, proxy configuration or systemd dependencies.

### Adopt independent log shipping

Keep the optional collector in its own Compose project or systemd service. Do
not add it to `depends_on` for the application, worker or database. Each of those
containers must retain rotated local logging even when the collector is stopped.
Read through the Docker API; do not tail Docker's internal local-driver files.
See [Docker's local logging documentation](https://docs.docker.com/engine/logging/drivers/local/).

Before enabling a collector, configure finite HTTP connection/request timeouts,
retry limits, queue/disk limits, CPU and memory limits, and rotation for its own
logs. Dropping telemetry when those limits are reached is preferable to filling
the host disk. Use a service allowlist and exclude secrets from labels. Treat
Docker socket access as privileged even with a read-only bind mount; isolate the
collector and use a restricted API proxy where available. Keep endpoint
credentials in deployment-owned secret files, outside this repository.

### Rehearse telemetry outages

Use a staging deployment and a verification account with fictional data. Record
the Compose revision and image IDs, plus the observed duration and outcome of
each check. Keep host addresses, credentials and incident records private.

1. Inspect the desired Compose logging and existing containers with `preflight`.
   Deliberately leave a staging container on the remote driver while Compose
   specifies local logging; verify preflight rejects it before an image pull or
   replacement. Restore rotated local logging before continuing.
2. Stop the separate collector and make its telemetry endpoints unavailable in
   the staging environment. Check its retry/queue/resource limits when restarted.
   Do not block the application's database or frontend proxy.
3. With remote telemetry still unavailable, start and stop the application and
   worker, then run the checked deployment and login/session verification. Confirm
   their logs remain readable through `docker compose logs`, new containers retain
   local logging, and replacement finishes without waiting for remote delivery.
   Test a MongoDB restart only during a planned staging database interruption.
4. Make InfluxDB unavailable and verify login and another member action complete.
   Check that background statistics jobs report delivery failure without delaying
   member requests. Lost best-effort statistics are not replayed.
5. Stall or block the analytics host in a browser and verify document readiness,
   login and session persistence. Repeat with `umami: { enabled: false }` and a
   fresh page load.
6. Restore telemetry and confirm the collector resumes within its configured
   bounds. Inspect local disk usage and collector errors. If the collector remains
   unhealthy, leave it stopped while the application continues using local logs.

If Docker commands already hang in an old logging driver, stop the deployment
attempt and recover Docker during a maintenance window. Do not repeatedly run
replacement, remove database storage, or delete Docker's internal log files.
After recovery, recreate affected containers with local logging and rerun
preflight. Verify rollback separately using the saved immutable image IDs.

The repository tests simulate stale remote logging, invalid rotation limits,
Docker timeouts and failed deployment recovery without touching containers:

```bash
python3 deploy/docker/test-production-deploy.py
```

These checks do not certify a production host. Track collector adoption and the
staging outage rehearsal against issue #3038 before marking the operational work
complete.

### Analytics outages

Umami loads asynchronously and does not gate document readiness or login.
Operators can disable script loading during an outage by adding
`umami: { enabled: false }` to deployment-owned `local.js` and restarting the
webapp. Failed external requests may still appear in browser network diagnostics;
they are not application failures. Existing trackers already loaded in an open
browser tab are removed only when the page reloads.
