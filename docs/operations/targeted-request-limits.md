# Targeted request-limit index rollout

The targeted sign-in, recovery, confirmation-resend and avatar-upload limits
store counters in the `requestlimits` collection. Before enabling the updated
application in production, create its unique and TTL indexes against the
application database:

```javascript
db.requestlimits.createIndex({ key: 1 }, { unique: true });
db.requestlimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

Run these commands with `mongosh` connected to the same database used by the
application. MongoDB 4.4 removes expired counter records asynchronously; the
application uses fixed, bounded windows and refuses a limited request with
HTTP 429 and `Retry-After`. The index can be created before deploying the
application because the collection is otherwise unused. Production disables
Mongoose automatic index creation, so do not rely on application startup to
create these indexes.

The HMAC used to store counter keys uses the application's shared
`sessionSecret`. In production, use a high-entropy secret and keep it
consistent across application instances. Rotating it changes every counter
key, so existing counters will no longer be found until their TTL cleanup
completes; coordinate a rotation as a reset of active request limits.
Test configuration sets high limits so route suites that deliberately issue
many requests from localhost remain unaffected.
