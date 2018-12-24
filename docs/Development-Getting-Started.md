OK, so you've read the [[dev|Development]] page, you're running the code locally, and now you're ready to dive into the code. Wonderful. Welcome.

## MEAN

Trustroots was built on MEAN. MEAN [isn't active anymore](https://github.com/Trustroots/trustroots/issues/638) so it's better not to rely too much on  [their documentation](http://meanjs.org/docs.html). Here's a few general pointers to get started:

* The app uses [MongoDB](https://www.mongodb.org/) for data storage.
* Node / Express server side to publish APIs.
* Angular client side to pull from APIs and render templates.
* The development stack is glued together with [grunt](http://gruntjs.com/) and other magic.

Also note that as of 2018Q4 we're moving to [React](. See also https://github.com/Trustroots/trustroots/labels/React

## Layout

You might want to read the [folder structure](http://meanjs.org/docs.html#folder-structure) to get a handle on how things are laid out. A quick summary:

* `modules/` contains one folder for each "component" of the site, this is where most of the interesting stuff lives
* `modules/**/server/` contains all the backend, server side stuff
  * `/models` defines the [Mongoose](http://mongoosejs.com/) models. There are only a few, so it might be worth scanning them to understand the data model. For in depth description, see [[database]].
  * `/controllers` as you'd expect, Express controllers live here.
  * `/routes` links url paths to controllers
  * `/tests` defines tests run server side
  * `/jobs` [Agenda](https://www.npmjs.com/package/agenda) job scheduler (~cron) jobs (see config/lib/agenda.js for more)
  * `modules/core/server/views` contains email templates and initial rendered index.html
* `modules/**/client/` contains all the client side stuff
    * `modules/core/client/app`
    * `modules/core/client/app/less` contains the site wide style variables and `application.less` file which includes rest of the modules.
    * `/less` is where you'll find **CSS styles** in [LESS format](http://lesscss.org/). Each module should have .less file with the module name, which then includes rest of the less files from the same folder. E.g.: `modules/core/client/app/less/application.less` includes `modules/messages/client/app/less/messages.less` which then includes `inbox.less` and `thread.less` from the same directory.
    * `/views` is where you'll find templates
    * `/services` is where you'll find [Angular service](https://docs.angularjs.org/guide/services), mostly for connecting to REST API points
    * `/config` contains the client side routes and other configs
    * `/directives` contains the [Angular directives](https://docs.angularjs.org/guide/directive)
    * `/controllers` contains the angular client side [controllers](https://docs.angularjs.org/guide/controller)
* `config/` ta-da, configs! Server side.
  * `/assets` Defines paths for assets (serverside JS, frontend CSS/JS/LESS, lib files etc) 
  * `/lib/env` primary config files. Don't modify anything else here except `local.js`.
  * `/lib/env/local.js` file overriding other `env/*` files. Put here your adjustments you don't want have publicly at the repo (it's git-ignored).
  * `/lib/agenda.js` [Agenda](https://www.npmjs.com/package/agenda) job scheduler (kinda like cron)
* `bower.js` frontend packages, managed with [Bower](http://bower.io/)
* `package.js` backend packages, managed with [NPM](https://www.npmjs.com/)
* `fontello.conf.js` config for icon font. Drag it to [Fontello](http://fontello.com/) to edit.


## Get stuck in

[Easy issues](../labels/easy) are a great place to start. These should be issues which are fairly easily fixable. Hopefully with the folder layout above, and a little diving into the code, you should be able to find and fix one or two of these issues. If you're just starting out with the code, these are a great way to contribute something really useful very quickly.

If you feel like checking out some docs before diving in, we recommend getting familiar especially with [AngularJS](https://angularjs.org/) as it intends to have steep learning curve.

Adding more significant features, major refactoring, and so on are typically handled by more experienced developers in the team. Don't forget to jump on [#trustroots on freenode](http://webchat.freenode.net/?channels=trustroots) to say hola, and hit us up there or in the issues if you have any questions. Thanks for helping out, we really appreciate it.

PS. You can also contact [Mikael](http://www.mikaelkorpela.fi/) and he'll walk you in to the project. 
