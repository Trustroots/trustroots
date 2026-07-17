# Docker

This directory is the **single** local Docker setup for Trustroots (dev, maildev,
mongodb, optional prod-like image test, data import, and production image build).

> Production is **not** deployed from this `docker-compose.yml`. Production runs
> images built by `dockerBuild.sh` elsewhere.

## First-time setup

Create `data/local.js` (the `data/` directory is gitignored). It is mounted into
the app and must point the database at the `mongodb` compose service and mail
at the `maildev` service:

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
      host: 'maildev',
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
- Maildev UI at http://localhost:1080 (SMTP to `maildev:1025` from the app).
- Runs `dev` + `mongodb` + `maildev`; the repo is bind-mounted.
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
