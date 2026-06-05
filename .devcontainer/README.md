# Dev Container

Linux development and test environment for Trustroots. Reuses
[`deploy/docker/dev.Dockerfile`](../deploy/docker/dev.Dockerfile) and
[`deploy/docker/docker-compose.yml`](../deploy/docker/docker-compose.yml).

Open the repository with **Dev Containers: Reopen in Container**. The container
runs `npm run check-environment`, which creates `config/env/local.js` and upload
directories when needed.

The app is not started automatically. Start it from the integrated terminal:

```sh
npm start
```

## Port aliases

Host ports default to container port + 10000 to avoid clashes with other local
apps. Set `TRUSTROOTS_DEV_*_HOST_PORT` before rebuilding to customize.

| Service               | Container port | Default host port |
| --------------------- | -------------: | ----------------: |
| Webpack dev server    |         `3000` |           `13000` |
| Express API/server    |         `3001` |           `13001` |
| MailDev web UI        |         `1080` |           `11080` |
| MongoDB               |        `27017` |           `37017` |
| LiveReload            |        `35729` |           `45729` |
| Node server inspector |         `5858` |           `15858` |
| Node worker inspector |         `5859` |           `15859` |

MongoDB is available inside the app container at `mongodb:27017`.

## Running tests

Run tests directly in the devcontainer terminal (no nested Docker):

```sh
# Full suite with coverage checks
npm run test:all

# Individual suites
npm run test:coverage:client
npm run test:coverage:server
npm run coverage:check -- --scope=client
npm run coverage:check -- --scope=server
npm run test:e2e
npm run coverage:report
```

For CI-parity E2E (prebuilt webpack, 2 workers):

```sh
CI=true npm run test:e2e
```

Headed Playwright (`npm run test:e2e:headed`) works inside the devcontainer when
a display is forwarded.
