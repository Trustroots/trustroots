# Running Trustroots locally

_These instructions are for installing locally. If you'd like to have containerised setup, see [INSTALL-DOCKER.md](INSTALL-DOCKER.md) instead._


### Prerequisites

Make sure you have installed all these prerequisites:
* [Node.js](http://www.nodejs.org/download/) ([previous versions](https://nodejs.org/en/download/releases/)) v4 and the NPM package manager. You can run multiple Node versions using [NVM](https://github.com/creationix/nvm).
* [MongoDB](http://www.mongodb.org/downloads), version 2.6+ or 3.0+ (2.2 is too old, check by typing `mongod --version`)
* [GraphicsMagick](http://www.graphicsmagick.org/). If you prefer [ImageMagick](http://www.imagemagick.org/) instead, change `imageProcessor` setting from configs to `imagemagic`. In Mac OS X, you can simply use [Homebrew](http://mxcl.github.io/homebrew/) and do:
```
brew install graphicsmagick
brew install imagemagick
```
* [Git](https://git-scm.com/) (`git --version`, preinstalled on OSX)
* Some of the NPM modules require compiling native code, which might require installing X-Code on OSX or `build-essential` and `make` on Linux.


### Installing

#### 1. Clone the repository:

```bash
git clone https://github.com/Trustroots/trustroots.git
```

#### 2. Make sure MongoDB is running on the default port (27017):

```bash
mongod
```

#### 3. Create a local config file:

```bash
cp config/env/local.sample.js config/env/local.js
```
Add any configurations you want to keep out of version control here.

##### 3.1 Configure Nodemailer
Many features (such as signup) rely on sending emails so configure at least `mailer` section from local.js. See [Nodemailer SMTP usage](https://github.com/andris9/nodemailer-smtp-transport#usage) and note that it has pre filled settings for [some services](https://github.com/andris9/nodemailer-smtp-transport#using-well-known-services).

For development we highly recommend using [MailDev](http://djfarrelly.github.io/MailDev/) to catch emails locally:
```bash
npm install -g maildev
maildev
```

Then simply uncomment MailDev configuration example from local.js file.

#### 4. Install Node modules:
```bash
npm install
```

#### 5. Finally start the app:
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.


### Running & development

- Stop the app by hitting `Ctrl+C`
- Run the app by typing `npm start`
- Run the app in production mode by typing `npm run start:prod`
- When you do changes to any files, they get recompiled and the browser is refreshed.
- Keep an eye on console in case of compiling errors.
- To read and debug MongoDB, use e.g. [Robomongo](https://robomongo.org/) to connect to your localhost.
- [Read more](https://github.com/Trustroots/trustroots/wiki/Development)


### Mock data

There's a script that can generate mock user data. It's highly recommended you run this script after installation, that way you'll have something to look at.

1. Make sure the collections offers and users are empty, in order to avoid duplicate values. This is the default on a new install.
2. Run `node scripts/fillTestData.js 10000 username` — that will create 10000 users and hosting offers. Username is optional (a-z0-9) and will create an admin user with that username.
3. It can take up to 5 minutes. Mongoose might complain about duplicates — just ignore these errors.
4. To see the result, log in with your chosen username and password `password`.


### Updating

Run these to get most recent version:
```bash
$ git pull            # Get the latest code for the current branch
$ npm update          # Update NPM
$ npm run migrate     # Migrate database up
```

...or simply `bash scripts/update.sh` which does this all for you.


### Running tests
- `npm test` (both client & server)
- `npm run test:client`
- `npm run test:server`
- `npm run test:server:watch` (run + watch for changes)
- `npm run test:server:watch:onlyChanged` (run + watch for changes and run only changed files)

### Problems

Check [troubleshooting](https://github.com/Trustroots/trustroots/wiki/Troubleshooting).
