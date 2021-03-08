# Development, in-depth documentation

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
