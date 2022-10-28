# Logging

### Server side code

Do not use `console.log/warn/error/info` directly: instead use our logger utility, which is a wrapper for [Winston](https://github.com/winstonjs/winston#readme)'s `log()` method. Logs are then collected from production server to a centralised place.

While developing, you will see them in Node.js console.

Example:

```js
const log = require('./config/lib/logger');

log('error', 'Example background job failed.', {
  jobId,
  error,
});
```

You can use these log levels `error`, `warn` and `info`.

It's okay to use `console.log/warn/error/info` in CLI scripts, server bootstrapping code and configuration files.

### Client side code

Do not use `console.log/warn/error/info` in files bundled for client side since they would be shipped to our users.

There is currently no method to use in React code.

We don't currently record client side error logging to centralised place.

See https://github.com/Trustroots/trustroots/issues/922
