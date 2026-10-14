# Dev Container

Linux development and test environment for Trustroots. Builds the `dev` service
from [`Dockerfile`](Dockerfile) and defines only the development support
services needed by the devcontainer.

Open the repository with **Dev Containers: Reopen in Container**. The container
runs `pnpm run check-environment`, which creates `config/env/local.js` and upload
directories when needed.

The app is not started automatically. Start it from the integrated terminal:

```sh
pnpm start
```

## Port aliases

Host ports default to container port + 10000 to avoid clashes with other local
apps. Set `TRUSTROOTS_DEV_*_HOST_PORT` before rebuilding to customize.

| Service               | Container port | Default host port |
| --------------------- | -------------: | ----------------: |
| Vite dev server       |         `3000` |           `13000` |
| Express API/server    |         `3001` |           `13001` |
| Mailpit web UI        |         `8025` |           `11080` |
| MongoDB               |        `27017` |           `37017` |
| LiveReload            |        `35729` |           `45729` |
| Node server inspector |         `5858` |           `15858` |
| Node worker inspector |         `5859` |           `15859` |

MongoDB is available inside the app container at `mongodb:27017`. Mailpit's
SMTP service is available at `mailpit:1025`; its web UI is bound to the host's
loopback interface at http://localhost:11080.

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
pnpm start
```

From a host terminal, print the available phone URLs:

```sh
node scripts/devcontainer/phone-url.js
```

Open one of those URLs on a phone connected to the same Wi-Fi network. The
Vite development server proxies requests to the API inside the devcontainer,
so port `13000` is the only port that needs to be reachable.
`TRUSTROOTS_DEV_WEBPACK_BIND_ADDRESS` still chooses which host address Docker
publishes.

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
pnpm run test:all

# Individual suites
pnpm run test:coverage:client
pnpm run test:coverage:server
pnpm run coverage:check --scope=client
pnpm run coverage:check --scope=server
pnpm run test:e2e
pnpm run coverage:report
```

For CI-parity E2E (prebuilt Vite client, 2 workers):

```sh
CI=true pnpm run test:e2e
```

Headed Playwright (`pnpm run test:e2e:headed`) works inside the devcontainer when
a display is forwarded.
