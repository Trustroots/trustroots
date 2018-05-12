# Changelog


## Application

We don't generally track changes in application here, but you could have a look at:
- [Blog](https://ideas.trustroots.org/)
- [Commits to master](https://github.com/Trustroots/trustroots/commits/master)
- [Closed issues](https://github.com/trustroots/trustroots/issues?q=is%3Aissue+is%3Aclosed)


## API

Versions at `package.json` describe API version.

See [API docs](http://developers.trustroots.org/docs/api/)

#### 0.3.3
Remove tags endpoints as un-used:
- GET `/api/tags`
- GET `/api/tags/:tagSlug`

Joining or leaving a tribe -API changed, new ones:
- DELETE `/api/users/memberships/:tribeId` - leave
- POST `/api/users/memberships/:tribeId` - join

#### 0.3.2
- Add endpoints for tags and tribes:
  - GET `/api/tribes`
  - GET `/api/tags`
  - GET `/api/tags/:tagSlug`
  - GET `/api/tribes/:tribeSlug`
  - POST/PUT/DELETE `/api/users/tags`
  - GET `/api/users/:username` now returns array tags and tribes by `member` object and array of id's by `memberIds` key.
  - GET `/api/users/:username` doesn't return `public` key anymore for other than authenticated user's profile.

#### 0.3.1
- Add endpoints for message thread references:
  - GET `/api/references/threads/:userToId`
  - POST `/api/references/threads`
