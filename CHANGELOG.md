# Changelog


## Application

We don't generally track changes in application here, but you could have a look at:
- [Blog](http://ideas.trustroots.org/)
- [Commits to master](https://github.com/Trustroots/trustroots/commits/master)
- [Closed issues](https://github.com/trustroots/trustroots/issues?q=is%3Aissue+is%3Aclosed)


## API

Versions at `package.json` describe API version.

See [API docs](http://developers.trustroots.org/docs/api/)

#### 0.3.1
- Add endpoints for message thread references:
  - GET `/api/references/threads/:userToId`
  - POST `/api/references/threads`
