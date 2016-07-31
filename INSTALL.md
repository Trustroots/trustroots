# Running Trustroots locally

_These instructions are for installing locally. If you'd like to have containerised setup, see [INSTALL-DOCKER.md](INSTALL-DOCKER.md) instead._


## Prerequisites

Make sure you have installed all these prerequisites:
* [Node.js](http://www.nodejs.org/download/) ([previous versions](https://nodejs.org/en/download/releases/)) v5 or v6 and the NPM package manager. You can run multiple Node versions using [NVM](https://github.com/creationix/nvm).
* [MongoDB](http://www.mongodb.org/downloads), version 2.6+ or 3.0+ (2.2 is too old, check by typing `mongod --version`)
* [RabbitMQ](https://www.rabbitmq.com/). In Mac OS X, you can simply use [Homebrew](http://mxcl.github.io/homebrew/) and do:
```
brew install rabbitmq
```
* [GraphicsMagick](http://www.graphicsmagick.org/). If you prefer [ImageMagick](http://www.imagemagick.org/) instead, change `imageProcessor` setting from `./configs/env/local.js` (see install step 2) to `imagemagic`. In Mac OS X, you can simply use [Homebrew](http://mxcl.github.io/homebrew/) and do:
```
brew install graphicsmagick
brew install imagemagick
```
* [Git](https://git-scm.com/) (`git --version`, preinstalled on OSX)
* Some of the NPM modules require compiling native code, which might require installing X-Code on OSX or `build-essential` and `make` on Linux.


## Installing

### 1. Clone the repository:

```bash
git clone https://github.com/Trustroots/trustroots.git
cd trustroots
```

### 2. Create a local config file:

```bash
cp config/env/local.sample.js config/env/local.js
```
Add here any configurations you want to keep out of version control.

### 3. Configure Nodemailer
Many features (such as signup) rely on sending emails so configure at least `mailer` section from newly created `local.js`. See [Nodemailer SMTP usage](https://github.com/andris9/nodemailer-smtp-transport#usage) and note that it has pre filled settings for [some services](https://github.com/andris9/nodemailer-smtp-transport#using-well-known-services).

For development we highly recommend using [MailDev](http://djfarrelly.github.io/MailDev/) to catch emails locally.

Install it:
```bash
npm install -g maildev
```

Run it:
```bash
maildev
```

See it running at [http://localhost:1080/](http://localhost:1080/).

Then simply uncomment MailDev configuration example from `local.js` file

### 4. Make sure MongoDB is running on the default port (27017):

```bash
mongod
```

Optional: If you need to modify connection settings, see `local.js` config file or use `DB_1_PORT_27017_TCP_ADDR` environment variable.

Optional: Installing [Robomongo](https://robomongo.org/) might come handy.

### 5. Make sure RabbitMQ is running on the default port (5672) with username/password "guest".

```bash
rabbitmq-server
```

Optional: If you need to modify connection settings, see `local.js` config file or use these environment variables: `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_LOGIN` & `RABBITMQ_PASSWORD`.

Optional: Setting up [RabbitMQ management tool](https://www.rabbitmq.com/management.html) might come handy.

### 6. Install Node modules:
```bash
npm install
```

### 7. Finally start the app:
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.


## Running & development

- Run the app in development mode by typing `npm start`. To skip checking Bower modules on start (useful if you're offline), type `npm run start:skipBower`
- Stop the app by hitting `Ctrl+C`
- Run the app in production mode by typing `npm run start:prod`
- When you do changes to any files, they get recompiled and the browser is refreshed.
- Keep an eye on console in case of compiling errors.
- [Read more](https://github.com/Trustroots/trustroots/wiki/Development)


## Mock data

There's a script that can generate mock user data. It's highly recommended you run this script after installation, that way you'll have something to look at.

1. Run `node scripts/fillTestData.js 10000 username` — that will create 10000 users and hosting offers. Username is optional (a-z0-9) and will create an admin user with that username.
2. It can take up to 5 minutes. Mongoose might complain about duplicates — just ignore these errors.
3. To see the result, log in with your chosen username and password `password`.


## Updating

Run these to get most recent version:
```bash
$ git pull            # Get the latest code for the current branch
$ npm update          # Update NPM
$ npm run migrate     # Migrate database up
```

...or simply `bash scripts/update.sh` which does this all for you.


## Running tests
- `npm test` (both client & server)
- `npm run test:client`
- `npm run test:client:watch` (run + watch for changes)
- `npm run test:server`
- `npm run test:server:watch` (run + watch for changes)

## Problems

Check [troubleshooting](https://github.com/Trustroots/trustroots/wiki/Troubleshooting).
