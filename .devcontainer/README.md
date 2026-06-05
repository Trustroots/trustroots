# Dev Container

This setup uses the existing development Docker configuration:

- `../docker-compose.yml` provides the `trustroots` and `mongodb` services.
- `.devcontainer/Dockerfile` provides the Node 16 development image, native build dependencies, and the MongoDB shell for app-container debugging.
- `../Dockerfile` is intentionally not used by the devcontainer so dev-only tooling does not affect the root image.
- `../production.Dockerfile` is intentionally not used because it builds the Passenger/nginx production image.

Open the repository with **Dev Containers: Reopen in Container**. The container installs dependencies with `npm ci` and runs the existing environment checks, which create `config/env/local.js` and upload directories when needed.

The app is not started automatically by the devcontainer so the editor container stays available even if the app crashes. Start it from the integrated terminal with:

```sh
npm start
```

The devcontainer publishes the common development ports from `.devcontainer/docker-compose.yml` using localhost-only aliases so they do not clash with other host apps:

| Service               | Container port | Default host port |
| --------------------- | -------------: | ----------------: |
| Webpack dev server    |         `3000` |           `13000` |
| Express API/server    |         `3001` |           `13001` |
| MailDev web UI        |         `1080` |           `11080` |
| MongoDB               |        `27017` |           `37017` |
| LiveReload            |        `35729` |           `45729` |
| Node server inspector |         `5858` |           `15858` |
| Node worker inspector |         `5859` |           `15859` |

Set the matching `TRUSTROOTS_DEV_*_HOST_PORT` environment variable before rebuilding the devcontainer if you need different host-side aliases.

Inside the app container, connect to the development database with:

```sh
mongo mongodb://mongodb:27017/trustroots-dev
```
