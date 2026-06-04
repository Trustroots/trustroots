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

The first run builds the dev image (installs dependencies); this is slow once.

### After changing dependencies

`node_modules` lives in a named volume seeded from the image, so rebuild and
recreate it when `package.json` / `package-lock.json` change:

```bash
docker compose build dev
docker volume rm trustroots_node_modules   # if native modules (sharp, canvas) misbehave after a rebuild
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
docker build -f ./production.Dockerfile . -t ghcr.io/trustrootsops/trustroots:latest
```
