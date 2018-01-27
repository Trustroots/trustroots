# Running Trustroots locally

_These instructions are for installing locally. If you'd like to have containerised setup, see [INSTALL-DOCKER.md](INSTALL-DOCKER.md) instead._


## Prerequisites

Make sure you have installed all these prerequisites:
* [Node.js](https://nodejs.org/en/download/) v6 and the NPM package manager (`node --version && npm --version`). You can run multiple Node versions using [NVM](https://github.com/creationix/nvm).
* [MongoDB](http://www.mongodb.org/downloads) v3 (`mongod --version`).
* [GraphicsMagick](http://www.graphicsmagick.org/). If you prefer [ImageMagick](http://www.imagemagick.org/) instead, change `imageProcessor` setting from `./configs/env/local.js` (see install step 2) to `imagemagic`. In Mac OS X, you can simply use [Homebrew](http://mxcl.github.io/homebrew/) and do:
```
brew install graphicsmagick
brew install imagemagick
```
* [Git](https://git-scm.com/) (`git --version`, preinstalled on OSX)
* Some of the NPM modules require compiling native code, which might require installing X-Code [Command line tools](https://railsapps.github.io/xcode-command-line-tools.html) on OSX or `build-essential` and `make` on Linux.


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

### 3. Make sure MongoDB is running on the default port (27017):

```bash
mongod
```

Optional: If you need to modify connection settings, see `local.js` config file or use `DB_1_PORT_27017_TCP_ADDR` environment variable.

Optional: Installing [Robomongo](https://robomongo.org/) might come handy.

### 4. Install Node modules:
```bash
npm install
```

### 5. Finally start the app:
```bash
npm start
```

Open [localhost:3000](http://localhost:3000) in your browser.

Additionally, [Maildev](http://danfarrelly.nyc/MailDev/) (dev email ui)
will be available at [localhost:1080](http://localhost:1080) and
[Agendash](https://github.com/joeframbach/agendash) (background job dashboard)
at [localhost:1081](http://localhost:1081).


## Running & development

- Run the app in development mode by typing `npm start`. To skip checking Bower modules on start (useful if you're offline), type `npm run start:skipBower`
- Stop the app by hitting `Ctrl+C`
- Run the app in production mode by typing `npm run start:prod`
- When you do changes to any files, they get recompiled and the browser is refreshed.
- Keep an eye on console in case of compiling errors.
- [Read more](https://github.com/Trustroots/trustroots/wiki/Development)


## Enable FCM push notifications (optional)

1. Create [FCM account](https://firebase.google.com/)

2. Go to [FCM console](https://console.firebase.google.com/) and create a new project

3. Open the project and hit small gear next to "Overview" at the sidebar so that you get to "project settings" page

4. Choose choose "Cloud messaging" tab, copy "Sender ID" number

5. Choose choose "Service accounts" tab

6. Either "create new service account" via "Manage all service accounts" link or choose existing one from the list (for development "Firebase Admin SDK" accont is fine)

7. "Generate new private key" button

8. Choose "json" format and you'll get a file to download

9. Add contents from that file to your `./config/env/local.js`:

    ```js
    fcm: {
      senderId: 'PASTE_YOUR_SENDER_ID_NUMBER_HERE',
      serviceAccount: PASTE_YOUR_JSON_CONFIG_HERE
    },
    ```

10. To stop eslint complaining, you might need to convert double quotes to single quotes. (`"` → `'`)


## Enable collecting statistics to InfluxDB (optional)

1. [Install InfluxDB](https://docs.influxdata.com/influxdb/latest/introduction/installation/) v1.0+ and run it (type `influxd`)

2. Add InfluxDB configuration to your `./config/env/local.js`:

    ```js
    influxdb: {
      enabled: true,
      options: {
        host: 'localhost',
        port: 8086, // default 8086
        protocol: 'http', // default 'http'
        // username: '',
        // password: '',
        database: 'trustroots'
      }
    }
    ```

3. You can observe data through InfluxDB admin panel: [localhost:8083](http://localhost:8083/) or optionally [install Grafana](http://docs.grafana.org/installation/) and connect it to InfluxDB.

4. [Read more](INFLUXDB.md) about the collected data and metrics


## Mock data

There's a script that can generate mock user data. It's highly recommended you run this script after installation, that way you'll have something to look at.

1. Run `node scripts/fillTestData.js 10000 adminusername` — that will create 10000 users and hosting offers. `adminusername` is optional (a-z0-9) and will create an admin user.
2. It can take up to 5 minutes. Mongoose might complain about duplicates — just ignore these errors.
3. To see the result, log in with your chosen username and password `password123`.


## Clean database
To drop your database, run:
```bash
npm run dropdb
```


## Updating

Run these to get most recent version:
```bash
$ git pull            # Get the latest code for the current branch
$ npm update          # Update NPM
$ npm run migrate     # Migrate database up
```

...or simply `./scripts/update.sh` which does this all for you.


## Running tests
- `npm test` (both client & server)
- `npm run test:client`
- `npm run test:client:watch` (run + watch for changes)
- `npm run test:server`
- `npm run test:server:watch` (run + watch for changes)

To test JavaScript files with eslint, run `npm run lint`.


## Problems

Check [troubleshooting](https://github.com/Trustroots/trustroots/wiki/Troubleshooting).
