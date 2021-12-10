# Running Trustroots locally

_These instructions are for installing locally. If you'd like to have containerised setup, see [Installing with Docker](Install-Docker.md) instead._

## Prerequisites

Make sure you have installed all these prerequisites:

- Unix operating system, like Linux or MacOS. If you use Windows, please look into installing via Docker instead.
- [Git](https://git-scm.com/) (`git --version`, preinstalled on MacOS)
- [Node.js](https://nodejs.org/en/download/):
  - See "engines" from [`package.json`](https://github.com/Trustroots/trustroots/blob/master/package.json#L11) for supported versions
  - Use `node --version && npm --version` to check your current version.
  - We recommend managing Node.js versions using [NVM](https://github.com/nvm-sh/nvm).
- [MongoDB](https://www.mongodb.org/downloads)
  - See "engines" from [`package.json`](https://github.com/Trustroots/trustroots/blob/master/package.json#L11) for supported versions
  - Use `mongod --version` to check your current version.
- Some of the NPM modules require compiling native code, which might require installing:
  - MacOS: X-Code's [Command line tools](https://railsapps.github.io/xcode-command-line-tools.html). You can install or confirm they're installed by running `xcode-select --install`
  - Linux: `build-essential` and `make`
- [GraphicsMagick](http://www.graphicsmagick.org/).
  - In MacOS, you can simply use [Homebrew](https://brew.sh/) to install it:
    ```bash
    brew install graphicsmagick
    ```

## Installing

### 1. Clone the repository:

```bash
git clone https://github.com/Trustroots/trustroots.git
cd trustroots
```

### 2. Make sure MongoDB is running on the default port (27017):

```bash
mongod
```

Optional: If you need to modify connection settings, see `config/env/local.js` config file.

### 3. Install dependencies and start the app:

```bash
npm ci
npm start
```

🎉 Open http://localhost:3000 in your browser.

#### Good to know

- Run the app by typing `npm start`.
- Run commands in production mode by appending `NODE_ENV` to command, e.g.: `NODE_ENV=production npm start`.
- Stop the app by hitting `Ctrl+C`.
- When you change any file, they get recompiled and the browser is refreshed.
- Keep an eye on the console in case of compiling errors.
- NPM dependencies can be updated with `npm ci`
- You can start clean by running `npm run dropdb && npm run distclean`.

## Modifying configurations

Add any configurations you want to keep out of version control to `config/env/local.js` file. It's created for you on the first start and overrides anything in `config/env/local.js`.

## Next Steps

Check out [Development Getting Started](./Development-Getting-Started.md) to learn more about general project structure.
Check out the [Development docs](./Development.md) for more info about tooling, mock data, running tests, etc.
