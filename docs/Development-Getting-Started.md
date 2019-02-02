# Getting started with Development

## Stack

Trustroots is fully written in JavaScript (both back- and frontend) on [Node.js](https://nodejs.org).

Our main data storage is [MongoDB](http://www.mongodb.org) which is a Document Database (and not a relational database like SQL databases are), and we access it with [Mongoose](https://mongoosejs.com/) which gives us Object Models.

We store additional data in [InfluxDB](https://www.influxdata.com/) for statistical purposes but developers typically don't need to interact with InfluxDB.

Our backend framework is [Express.js](https://expressjs.com/).

Our frontend framework is [Angular v1](https://angularjs.org/) written in ES5 version of JavaScript but [we are migrating](React.md) to ES6 version and [React](https://reactjs.org/).

The application is compiled and served using [Gulp](https://gulpjs.org/) and [Webpack](https://webpack.js.org/).

[Babel](https://babeljs.io/) that transpiles modern ES6 frontend code back to ES5 that most browsers understand.

Our stylesheets are written in [LESS](http://lesscss.org/) and our UI uses [Bootstrap v3](https://getbootstrap.com/docs/3.3/) framework quite extensively.

## Architecture in short

- Express.js server side serves content from API end-points.
- In backend code, you would typically interact with [Mongoose](https://mongoosejs.com/) object models such as "Tribe" or "User". These match MongoDB collections "tribes" and "users".
- Angular.js single page application (and soon React) reads data from the API and renders templates.
- The application is divided into modules by main features; one for messaging, one for users etc. Each module contains server-side files, client-side files and tests for that specific feature:

```
└── modules
    └── module-name
        ├── client
        ├── server
        └── tests
            ├── client
            └── server
```

[Development documentation](Development.md) dives deeper into architecture and folder layout.

### Codebase' origin

Trustroots was built upon [MEAN.js boilerplate](http://meanjs.org/) (from _Mongo-Express-Angular-NodeJS_). MEAN [isn't active anymore](https://github.com/Trustroots/trustroots/issues/638) and we've modified the codebase extensively for our own purposes, so it's better not to rely too much on [their documentation](http://meanjs.org/docs.html).

While boilerplate was a great way to get started with rather large application, we inherited a lot of cruft and kinda complicated setup from it. As time has passed, several aspects of the application are not that modern anymore and we have [lots to do](https://github.com/Trustroots/trustroots/projects/4) to bring it up to date.

Note that [meanjs.org](http://meanjs.org/) and [mean.io](http://mean.io/) are two separate projects. The former [was a fork of mean.io in 2014](http://blog.meanjs.org/post/76726660228/forking-out-of-an-open-source-conflict). Trustroots was built on the meanjs.org version.

## Where to start?

First of all, [get the application running](https://developers.trustroots.org/Install.html) and perhaps familiarise yourself little bit more with [development documentation](https://developers.trustroots.org/).

[Easy issues](https://github.com/Trustroots/trustroots/issues?q=is%3Aissue+is%3Aopen+label%3Aeasy) are a great place to start work. These should be issues which are fairly easily fixable.

Hopefully with a little diving into the code, you should be able to find and fix one or two of these issues. If you're just starting out with the code, these are a great way to contribute something really useful very quickly.

Adding more significant features, major refactoring, and so on are typically handled by more experienced developers in the team.

Contact us so that you can join the chatter over at Slack and introduce yourself. 🙂 See [developers.trustroots.org](https://developers.trustroots.org/) for details.

_Thanks for helping out, we really appreciate it!_

## Further studying

If you feel like checking out some docs before diving in fixing bugs with old Angular -sections of the frontend codebase, we recommend getting familiar with [AngularJS documentation](https://angularjs.org/) as it intends to have steep learning curve.

If you're working on some of the newer parts of the frontend code, official [React documentation](https://reactjs.org/) is great.

While our JavaScript codebase is mostly still in older ES5 format, we are fast moving towards modern ES6. Here are few resources to get up to speed with ES6:

- [JavaScript Allongé, the "Six" Edition](https://leanpub.com/javascriptallongesix/read)
- [Exploring ES6](http://exploringjs.com/es6/)
- [What the heck is the event loop anyway?](https://www.youtube.com/watch?v=8aGhZQkoFbQ) – short presentation that sheds some light on how asynchronous operations are executed in JavaScript
- [ES6 cheatsheet](https://github.com/DrkSephy/es6-cheatsheet)
