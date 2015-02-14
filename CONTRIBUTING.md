**Check https://github.com/Trustroots/trustroots/wiki/Volunteering**

Trustroots is implemented in [MEAN](http://mean.io/#!/), Mongo, Express, Angular, Node.

### Git workflow for contributors

* Clone this repo (see [README.md](https://github.com/Trustroots/trustroots/blob/master/README.md) how to install)
* `git checkout master`
* `git pull`
* `git checkout -b ticket_featurename`
* Commit as normal, `git commit`
* `git push origin ticket_featurename` (makes sure your code is saved on GitHub)
* Once your work is ready to share...
    * `git pull`
    * `git merge master`
    * resolve any conflicts
    * `git push`
    * tests (automated and otherwise)
    * Create a pull request on GitHub

Anyone can merge pull requests, but it usually makes sense to have them code reviewed by somebody else, so it's usually a good idea for somebody else to merge your pull requests.

## Coding conventions

Project has [.editorconfig](https://github.com/Trustroots/trustroots/blob/master/.editorconfig) file, we recommend to [download extension for your IDE](http://editorconfig.org/#download).

### Most important
- Indentation with 2 spaces
- Beginning brace on the same line as the beginning statement
- File names use dash to separate words. For example: foo-bar.js
- Use camelCase for identifiers. Functions and variable names should be named like `doAThing`, not `do_a_thing`.

### JS
- _**TODO**_

### CSS/LESS
- Use [LESS CSS](http://lesscss.org/) for CSS.

#### CSS class names
- Name reusable bits of layouts by module names and keep them out of page styles, (eg. `.group-badge` can be used in multiple places around the site.)
- Related elements within a module use the base name as a prefix. For example module `.panel` has also `.panel-header`, `.panel-body` and `.panel-footer`.
- Prefix state rules with `.is-` (for example `.is-collapsed`).

## Route conventions
_**TODO: Review**_

Convention is as follows:
* Url has the plural like `/messages/`, `/users/`, `/users/:userId/photos`, `/users/:userId/references`
* The id is the singular name followed by `Id` like `userId`, `photoId`, etc
* The route with the id is called nameSingle like `usersSingle`, `offersSingle`, etc
* Template name matches route name
* Nested routes are simply concatenated like `usersSingleReferences` or `usersSinglePhotosSingle`

Examples

* `/users` route name `users`
* `/users/:username` route name `usersSingle`
* `/users/:username/edit` route name `usersSingleEdit`
* `/users/:username/photos` route name `usersSinglePhotos`
* `/users/:username/photos/edit` route name `usersSinglePhotosEdit`
* `/users/:username/photos/:photoId` route name `usersSinglePhotosSingle`
* `/users/:username/photos/:photoId/edit` route name `usersSinglePhotosSingleEdit`
* `/messages` route name `messages`
* `/messages/:userId` route name `messagesThread` - deviates because it is `userId` not `messageId`
