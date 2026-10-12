# Docker

This directory contains the local Docker setup and production support tools.
Production uses a separate, deployment-owned Compose file and images published
by GitHub Actions.

## Files

- `docker-compose.yml` — local development and optional production-like services.
- `docker-compose.ci.yml` — CI overrides for the local stack.
- `dev.Dockerfile` — development and CI image.
- `nginx-confd.conf`, `webapp.conf` — configuration copied into the production image.
- `fetchMongoDumps.sh`, `importMongoData.sh` — local data import helpers.
- `dockerBuild.sh` — manual production image build and push.
- `production-deploy.py`, `test-production-deploy.py` — deployment tool and tests.
- `data/`, `mongodumps/` — ignored local configuration and data.

The production Dockerfile is at the repository root: `production.Dockerfile`.

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
- The production image installs the full dependency tree to build assets, then
  removes development dependencies before packaging the runtime image.
- This is only for local verification; it is not how production is deployed.

## Importing MongoDB data

With the stack running, import dumps into the `trustroots` database. Fetching
requires SSH access to the source server and `pv` locally; importing requires
Docker Compose and `gunzip`. The import prompts before dropping the local database:

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

For dependency changes, see [After changing dependencies](#after-changing-dependencies).

## Other profiles

- `--profile stats` — influxdb + grafana
- `--profile mongo-localhost` — expose mongodb on 127.0.0.1:27017

## Production

See [production operations](PRODUCTION.md) for image publishing, deployment
checks, rollback, storage and logging configuration, and telemetry outages.
