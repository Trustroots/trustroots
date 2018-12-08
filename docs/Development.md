# Installation
* See [README.md](https://github.com/Trustroots/trustroots/blob/master/README.md#installing) for how to get started.
* To install mobile app (Android), see [mobile repository](https://github.com/Trustroots/Trustroots-React-Native).

# Join the team?
* Contact us via [form](https://www.trustroots.org/contact), drop [Mikael](http://www.mikaelkorpela.fi) a message or join the chat [on IRC](http://webchat.freenode.net/?channels=trustroots).
* See [issue list](https://github.com/Trustroots/trustroots/issues/) and read about [[milestones]].
* We're quite planned and tasks are done in prioritised order so starting to write code without communicating with the team first mixes up things. It doesn't mean that you can't work on other things. We value all progress. If you've found a bug, feel free to just fix it and send us pull requests. That said, drop us a line first before you start working on something bigger.
* Our features list is kept short and simple. While many things would be awesome to have, it sometimes makes more sense to make less but better. We know it's fun to work on your own ideas but this is a team effort. Avoid clutter and keep things simple.
* It would be good if you'd get familiar with the code base with smaller tasks, see [easy](https://github.com/Trustroots/trustroots/issues?q=is%3Aopen+is%3Aissue+label%3Aeasy) tag for those. Ask us for guidance and we'll help.
* We're looking forward to work with proactive, talented hackers! :-) It's easier to work with people who can commit for longer term, who are proactive and can work independently. [Kudos!](https://github.com/Trustroots/trustroots/blob/master/public/humans.txt)

# How to write code
* Master is the most up-to-date branch and updated frequently. New feature branches are under our own repository and work is merged via pull requests, apart from very small changes. If you're not actively working on Trustroots yet, just fork the project and send pull requests from your repo.
* [Tests](#Testing)! [We use Travis-cli](https://travis-ci.org/) to inform us when something fails. Don't be the weasel! :-)
* Write [JSDoc](http://usejsdoc.org/) comment blocks, please, or add them when you see them missing.
* Check [[Accessibility]].
* [Mikael](https://github.com/simison) is responsible of deployments to production, ask more for details.
* We're aiming for [continuous delivery](https://en.wikipedia.org/wiki/Continuous_delivery) methods (not quite there yet, but almost).

# The application
* **MEAN** stack, seeded originally with [MEAN.js](http://meanjs.org/) boilerplate: [MongoDB](www.mongodb.org), [ExpressJS](http://expressjs.com/), [AngularJS](https://angularjs.org/) v1, [NodeJS](http://nodejs.org/). Additionally stuff like [Bootstrap](http://getbootstrap.com/), [Leaflet](http://leafletjs.com/) etc. 
* [[Database]] scheme (look for `*.server.model.js` project files to check most up to date info)

# The mobile app
We have a React Native app for Android written in ClojureScript: https://github.com/Trustroots/Trustroots-React-Native

## Coding conventions
- Project has [.editorconfig](https://github.com/Trustroots/trustroots/blob/master/.editorconfig) file, we recommend to [download extension for your IDE](http://editorconfig.org/#download).
- Build script checks all the files against our [ESLint rules](https://github.com/Trustroots/trustroots/blob/master/.eslintrc.js). Fix errors before submitting PR.

### Most important
- Indentation with 2 spaces
- Beginning brace on the same line as the beginning statement
- File names use dash to separate words. For example: foo-bar.js
- Use camelCase for identifiers. Functions and variable names should be named like `doAThing`, not `do_a_thing`.

### JS
- See [Angular 1 Style Guide](https://github.com/johnpapa/angular-styleguide/blob/master/a1/README.md)
- Somewhat along the lines of [AirBnb JavaScript style guide](https://github.com/airbnb/javascript) (ESLint enforces these, too)

### CSS/LESS
- We use [LESS CSS](http://lesscss.org/) for CSS.
- Build as generic modules as possible. Rather `.panel` than `.about-box`.

#### CSS class names
- Name reusable bits of layouts by module names and keep them out of page styles, (eg. `.group-badge` can be used in multiple places around the site.)
- Related elements within a module use the base name as a prefix. For example module `.panel` has also `.panel-header`, `.panel-body` and `.panel-footer`.
- Prefix state rules with `.is-` (for example `.is-collapsed`).

## Route conventions
_**TODO: Outdated**_

Convention is as follows:
* Url has the plural like `/messages/`, `/users/`, `/users/:userId/photos`, `/users/:userId/references`
* The id is the singular name followed by `Id` like `userId`, `photoId`, etc
* The route with the id is called nameSingle like `usersSingle`, `offersSingle`, etc
* Template name matches route name
* Nested routes are simply concatenated like `usersSingleReferences` or `usersSinglePhotosSingle`

### Examples

* `/users` route name `users`
* `/users/:username` route name `usersSingle`
* `/users/:username/edit` route name `usersSingleEdit`
* `/users/:username/photos` route name `usersSinglePhotos`
* `/users/:username/photos/edit` route name `usersSinglePhotosEdit`
* `/users/:username/photos/:photoId` route name `usersSinglePhotosSingle`
* `/users/:username/photos/:photoId/edit` route name `usersSinglePhotosSingleEdit`
* `/messages` route name `messages`
* `/messages/:userId` route name `messagesThread` - deviates because it is `userId` not `messageId`

## Testing

#### Strategy:
##### CI setup
Slowly getting there. Any help/experiences appreciated! [#228](https://github.com/Trustroots/trustroots/issues/228) 

##### Unit tests
...mainly to test Mongo models ([example](https://github.com/Trustroots/trustroots/blob/master/modules/users/tests/server/user.server.model.tests.js)).

...as well some critical bits of Angular frontend ([example](https://github.com/Trustroots/trustroots/blob/master/modules/users/tests/client/authentication.client.controller.tests.js )).

##### Integration tests
... mainly for the API routes ([example](https://github.com/Trustroots/trustroots/blob/master/modules/messages/tests/server/message.server.routes.tests.js)).

##### End-to-end tests with Selenium
We have a free [Automate account](https://www.browserstack.com/automate) with Browserstack ([#199](https://github.com/Trustroots/trustroots/issues/199), [blog](http://ideas.trustroots.org/2015/04/07/selenium-browserstack-testing/)) — this is offered to us for free since we're an open source project. This makes it very easy for us to test the project on tons of different browsers on various platforms, including [MSIE](https://github.com/Trustroots/trustroots/issues/45).

Written in Python, using Selenium ([#225](https://github.com/Trustroots/trustroots/issues/225)).

_(Selenium tests are currently out of date.)_

#### Run tests
* `npm test` for everything,
* `npm run test:server` for Mocha tests,
* `npm run test:server:watch` same with watching,
* `npm run test:client` for testing Karma-unit tests and 
* `npm run test:selenium` to run Selenium tests. Requires Python. Make sure Trustroots is running already as this task won't spin it up first. This task isn't included in the main test task. If you want to pass custom domain to test for Selenium you can do so by running: `python ./scripts/selenium/test.py http://dev.trustroots.org/`

## Documentation
Documents our internal API end points. Great help for writing integration tests.

[developers.trustroots.org/docs/api](http://developers.trustroots.org/docs/api/)

[Swagger editor](http://editor.swagger.io/) file: [swagger.json](https://raw.githubusercontent.com/Trustroots/developers/gh-pages/docs/swagger.json)

## More?
See [developers.trustroots.org](http://developers.trustroots.org/)
