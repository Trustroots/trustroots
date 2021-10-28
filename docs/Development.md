# Development, in-depth documentation
For a high-level overview, see the [getting started docs](./Development-Getting-Started.md).

# The application

- **MEAN** stack, seeded originally with [MEAN.js](http://meanjs.org/) boilerplate: [MongoDB](www.mongodb.org), [ExpressJS](http://expressjs.com/), [AngularJS](https://angularjs.org/) v1 ([we're migrating](./React.md) to [React](https://reactjs.org/)), [NodeJS](http://nodejs.org/). Additionally stuff like [Bootstrap](http://getbootstrap.com/) v3 for component styles, [Leaflet](http://leafletjs.com/) for the map, etc.
- Database scheme (look for `*.server.model.js` project files to check most up to date info)
- We're migrating the client to React. Read a [migration guide](React.md).

# The mobile app

- We have [a basic Webview app](https://github.com/Trustroots/trustroots-expo-mobile/) written in React Native and Expo.io which mostly just gets you push notifications and an icon on phone's screen. :-)
- We have [in-the-works React Native app](https://github.com/Trustroots/trustroots-mobile/).

## Coding conventions

- Project has [.editorconfig](https://github.com/Trustroots/trustroots/blob/master/.editorconfig) file, we recommend to [download extension for your IDE](http://editorconfig.org/#download).
- Build script checks all the files against our [ESLint rules](https://github.com/Trustroots/trustroots/blob/master/.eslintrc.js). Fix errors before submitting PR and add integration for your IDE.
- [Prettier](https://prettier.io/) codeformatter is configured so you might want to install integration for your IDE.

### Other conventions

- File names use dash to separate words. For example: foo-bar.js (except for React Components `CamelCase.js`)
- Use camelCase for identifiers. Functions and variable names should be named like `doAThing`, not `do_a_thing`.

### JS

- See [Angular 1 Style Guide](https://github.com/johnpapa/angular-styleguide/blob/master/a1/README.md)
- We're migrating to ES2018. Write your code in modern JavaScript. Read a [migration manual](ES2018.md).

### CSS/LESS

- We use [LESS CSS](http://lesscss.org/) for CSS.
- Build as generic and re-usable components as possible. Rather `.panel` than `.about-box`.

#### CSS class names

- Name reusable bits of layouts by module names and keep them out of page styles, (eg. `.group-badge` can be used in multiple places around the site.)
- Related elements within a module use the base name as a prefix. For example module `.panel` has also `.panel-header`, `.panel-body` and `.panel-footer`.
- Prefix state rules with `.is-` (for example `.is-collapsed`).

## Route conventions

_**TODO: Outdated**_

Convention is as follows:

- Url has the plural like `/messages/`, `/users/`, `/users/:userId/photos`, `/users/:userId/references`
- The id is the singular name followed by `Id` like `userId`, `photoId`, etc
- The route with the id is called nameSingle like `usersSingle`, `offersSingle`, etc
- Template name matches route name
- Nested routes are simply concatenated like `usersSingleReferences` or `usersSinglePhotosSingle`

### Examples

- `/users` route name `users`
- `/users/:username` route name `usersSingle`
- `/users/:username/edit` route name `usersSingleEdit`
- `/users/:username/photos` route name `usersSinglePhotos`
- `/users/:username/photos/edit` route name `usersSinglePhotosEdit`
- `/users/:username/photos/:photoId` route name `usersSinglePhotosSingle`
- `/users/:username/photos/:photoId/edit` route name `usersSinglePhotosSingleEdit`
- `/messages` route name `messages`
- `/messages/:userId` route name `messagesThread` - deviates because it is `userId` not `messageId`

## Testing

#### Strategy:

##### CI setup

Slowly getting there. Any help/experiences appreciated! [#228](https://github.com/Trustroots/trustroots/issues/228)

##### Unit tests

...mainly to test Mongo models ([example](https://github.com/Trustroots/trustroots/blob/master/modules/users/tests/server/user.server.model.tests.js)).

...as well some critical bits of Angular frontend ([example](https://github.com/Trustroots/trustroots/blob/master/modules/users/tests/client/authentication.client.controller.tests.js)).

##### Integration tests

... mainly for the API routes ([example](https://github.com/Trustroots/trustroots/blob/master/modules/messages/tests/server/message.server.routes.tests.js)).

##### Clientside Component tests

- Look for `modules/*/tests/client/components`
- Written with [React Testing Library](https://www.npmjs.com/package/@testing-library/react)

#### Run tests

- `npm test` for everything,
- `npm run test:server` for Mocha tests,
- `npm run test:server:watch` same with watching,
- `npm run test:client` for testing Karma-unit tests and
- `npm run test:selenium` to run old outdated Selenium tests. Requires Python. Make sure Trustroots is running already as this task won't spin it up first. This task isn't included in the main test task. If you want to pass custom domain to test for Selenium you can do so by running: `python ./scripts/selenium/test.py https://dev2.trustroots.org/`

## Development tools

### Emails

MailDev is there for viewing and testing emails during development.

[MailDev](https://github.com/maildev/maildev) will be already running at [localhost:1080](http://localhost:1080) but if you need to run it manually, type:

```bash
npm run dashboard:mail
```

### Background jobs

[Agendash](https://github.com/agenda/agendash) is a dashboard & inspector for [Agenda](https://github.com/agenda/agenda), our job scheduling library.

To run it at [localhost:1081](http://localhost:1081), type:

```bash
npm run dashboard:jobs
```

## Debugging

The standard node inspector runs on each start for the main app (port 5858) and the worker (port 5859).

To debug using Chrome:

1. Run 'npm start'
2. Open `chrome://inspect/#devices`. Note the "Remote Target" list should be empty to start
3. Press "Open dedicated DevTools for Node"
4. Press "Add connection" and add both `localhost:5858` and `localhost:5859`
5. They will now appear in "Remote Target" list
6. Press 'inspect' on whichever process you want to debug
7. You should now have console/profiler etc available.

More information can be found in the NodeJS [debug documentation](https://nodejs.org/en/docs/guides/debugging-getting-started/).

## Access the server from another device

- Make sure you are connected to the same network (WIFI/LAN). Find your ip address using `ipconfig` or `ifconfig`.
- Add `host: null` into `config/env/local.js`
- Alternatively you can also use service like [Ngrok](https://ngrok.com).

## Analyzing bundles

You can see what goes into the "bundle" that [Webpack](https://webpack.js.org/) compiles from all the JS, style and image assets by adding this to your `config/env/local/js`:

```js
bundleAnalyzer: {
  enabled: true,
  // See https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin
  options: {},
},
```

Now when you start the application, [bundle analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer#readme) will automatically open new browser tab at `http://127.0.0.1:8888/` that shows you information about the bundle.

## Coding styles

We apply [Eslint](https://eslint.org/) rules to our JavaScript files and automatically format them using [Prettier](https://prettier.io/). You should install [Eslint editor integration](https://eslint.org/docs/user-guide/integrations#editors) as well [Prettier editor integration](https://prettier.io/docs/en/editors.html) to notice code formatting errors and let the editor autoformat files for you automatically.

Files are autoformatted by Prettier each time you `git commit` your changes.

Files are also continuously linted as you modify them when running `npm start`, but if you need to lint all the files separately, run:

```bash
npm run lint
```

To continuously lint files as you modify them, run:

```bash
npm run lint:watch
```

To let Eslint fix linting errors automatically, append `-- --fix` to either regular lint or -watch command like so:

```bash
npm run lint:watch -- --fix
```

## Mock data

There is a data script that the individual mock data scripts with default values to generate mock user data, hosting offers, messages and tribes. It's highly recommended you run this script after installation, that way you'll have something to look at.

Run `npm run seed` - This will add automatically add:

- 100 tribes
- 1000 users including 3 users with user names of `admin1`, `admin2`, `admin3` each with the password of `password123`
- 2000 message threads with 1 to 10 messages in each thread

For more custom setups, you can alternatively run the scripts for generating data individually. It is currently recommended that you run them in the sequence provided below.

1. To add tribes, run `npm run seed:tribes 50` — This will create 50 tribes.

   - Run this prior to adding users to add users to tribes automatically

2. To add users, run `npm run seed:users 1000 -- --userNames adminusername` — This will create 1000 users and hosting offers. `adminusername` is optional (a-z0-9) and will create an admin user.

   - It can take up to 5 minutes. Mongoose might complain about duplicates — just ignore these errors.
   - To see the result, log in with your chosen username and password `password123`.
   - Additional admin usernames are also supported (eg. `npm run seed:users 1000 -- --userNames admin1 admin2 admin3`)
   - If tribes exist, users will also be added to random tribes

3. To add messages, run `npm run seed:messages 1000 10` — This will create 1000 message threads between random users with up to 10 messages in each thread.

All scripts additionally support `--debug` and `--limit` flags showing database debug information and not creating new elements if the number of database items already exist respectively.

## Clean database

To drop your database, run:

```bash
npm run dropdb
```

## Enable FCM push notifications (optional)

1. Create [FCM account](https://firebase.google.com/)

2. Go to [FCM console](https://console.firebase.google.com/) and create a new project

3. Open the project and hit the small gear next to "Overview" at the sidebar so that you get to "project settings" page

4. Choose "Cloud messaging" tab, copy "Sender ID" number

5. Choose "Service accounts" tab

6. Either "create new service account" via "Manage all service accounts" link or choose existing one from the list (for development, "Firebase Admin SDK" account is fine)

7. Click on the "Generate new private key" button

8. Choose "json" format and you'll get a file to download

9. Add contents from that file to your `./config/env/local.js`:

   ```js
   fcm: {
     senderId: 'PASTE_YOUR_SENDER_ID_NUMBER_HERE',
     serviceAccount: PASTE_YOUR_JSON_CONFIG_HERE
   },
   ```

10. To stop Eslint from complaining, you might need to convert double quotes to single quotes. (`"` → `'`) or [disable Eslint](https://eslint.org/docs/user-guide/configuring#disabling-rules-with-inline-comments) for those lines.

## Enable collecting statistics to InfluxDB (optional)

1. [Install InfluxDB](https://docs.influxdata.com/influxdb/) v1.0+ and run it (type `influxd`)

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

## Use ImageMagick instead of GraphicsMagick

If you prefer [ImageMagick](http://www.imagemagick.org/) over [GraphicsMagick](http://www.graphicsmagick.org/):

1. In MacOS, you can simply use [Homebrew](https://brew.sh/) to install it:

   ```bash
   brew install imagemagick
   ```

2. Change `imageProcessor` setting from `./configs/env/local.js` to `imagemagic`.

## Folder layout

You might want to read the [folder structure](http://meanjs.org/docs.html#folder-structure) to get a handle on how things are laid out, although we've started deviating from it with Angular.js to [React migration](./React.md). A quick summary:

- `modules/` contains one folder for each "component" of the site, this is where most of the interesting stuff lives
- `modules/**/server/` contains all the backend, server side stuff
  - `/models` defines the [Mongoose](https://mongoosejs.com/) models. There are only a few, so it might be worth scanning them to understand the data model. For in depth description, see [[database]].
  - `/controllers` as you'd expect, Express controllers live here.
  - `/routes` links url paths to controllers
  - `/tests` defines tests run server side
  - `/jobs` [Agenda](https://www.npmjs.com/package/agenda) job scheduler (~cron) jobs (see config/lib/agenda.js for more)
  - `modules/core/server/views` contains email templates and initial rendered index.html
- `modules/**/client/` contains all the client side stuff
  - `modules/core/client/app`
  - `modules/core/client/app/less` contains the site wide style variables and `application.less` file which includes rest of the modules.
  - `/less` is where you'll find **CSS styles** in [LESS format](http://lesscss.org/). Each module should have .less file with the module name, which then includes rest of the less files from the same folder. E.g.: `modules/core/client/app/less/application.less` includes `modules/messages/client/app/less/messages.less` which then includes `inbox.less` and `thread.less` from the same directory.
  - `/views` is where you'll find Angular.js templates
  - `/api` functions for communicating with REST API points, used in React components and not with Angular.js stuff; Angular uses `/services` insteead.
  - `/services` is where you'll find [Angular service](https://docs.angularjs.org/guide/services), mostly for connecting to REST API points. Not used in React components; those use `/api` instead.
  - `/config` contains the client side routes and other configs
  - `/directives` contains the [Angular directives](https://docs.angularjs.org/guide/directive)
  - `/controllers` contains the angular client side [controllers](https://docs.angularjs.org/guide/controller)
  - `/components` contains React components. [Read more about our React migration](./React.md)
  - `/utils` containts utility functions used mostly with React components.
  - `/images` Images for the module.
- `config/` ta-da, configs! Server side.
  - `/assets` Defines paths for assets (serverside JS, frontend CSS/JS/LESS, lib files etc)
  - `/lib/env` primary config files. Don't modify anything else here except `local.js`.
  - `/lib/env/local.js` file overriding other `env/*` files. Put here your adjustments you don't want have publicly at the repo (it's git-ignored).
  - `/lib/agenda.js` [Agenda](https://www.npmjs.com/package/agenda) job scheduler (kinda like cron)
  - `/lib/worker.js` Configures all cron jobs with above Agenda
  - `/lib/express.js` Sets up the server side application and routes
  - `/lib/app.js` Boot up function for the serverside app.
  - `/lib/facebook-api.js` Sets up Facebook Graph API client
  - `/lib/firebase-messaging.js` Sets up Firebase for push notifications
  - `/lib/mongoose.js` Sets up database connection and related utilities.
  - `/lib/render.js` Configuration for Nunjucs, a serverside template renderer
  - `/lib/logger.js` Configures error logging service
  - `/lib/exponent-notifications.js` Expo.io based mobile app push notifications
- `server.js` server entrypoint; for APIs and serving the fontend client
- `worker.js` background job runner entrypoint, for running Agenda
- `package.js` dependencies, managed with [NPM](https://www.npmjs.com/)

## Support

- Check and open issues at [GitHub](https://github.com/Trustroots/trustroots/issues)
- [Contact us](https://www.trustroots.org/contact)
- [Volunteer chat](https://team.trustroots.org/Chat.html)
