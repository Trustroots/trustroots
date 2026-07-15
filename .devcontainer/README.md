# Dev Container

Linux development and test environment for Trustroots. Builds the `dev` service
from [`Dockerfile`](Dockerfile) and defines only the development support
services needed by the devcontainer.

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

## Testing on a phone

The development server is deliberately available only on the host by default.
To make it available to devices on your local network, start VS Code from a
host terminal with this environment variable, then use **Dev Containers:
Rebuild and Reopen in Container**:

```sh
TRUSTROOTS_DEV_WEBPACK_BIND_ADDRESS=0.0.0.0 code .
```

Start the app in the devcontainer as usual:

```sh
npm start
```

From a host terminal, print the available phone URLs:

```sh
node scripts/devcontainer/phone-url.js
```

Open one of those URLs on a phone connected to the same Wi-Fi network. The
webpack development server proxies requests to the API inside the devcontainer,
so port `13000` is the only port that needs to be reachable.

Keep the default binding for ordinary development. When phone testing is
finished, close VS Code and reopen it normally (without the environment
variable), then rebuild the devcontainer to return the port to host-only
access.

If the phone cannot connect, check that it is on the same Wi-Fi network and
that the host firewall allows incoming connections to port `13000`.

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
