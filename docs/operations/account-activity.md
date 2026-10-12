# Account activity history deployment

Account activity is stored separately from member profiles. The collection
keeps only event type, owner, timestamp and whether a session event describes
the session which created it. It does not store credentials, action tokens,
session-store IDs, IP addresses, browser fingerprints or message content.

Events are retained for 90 days. MongoDB TTL deletion is asynchronous, so an
expired event can remain briefly after its retention period. Production has
Mongoose automatic index creation disabled; create the indexes before
deploying the application version which reads this collection:

```sh
npm run ensure-indexes -- AccountActivity
```

The index command creates a TTL index on `createdAt` and a member/timestamp
index for paginated history reads. Account removal deletes the member’s
activity rows as part of the removal flow. Activity history is not
reconstructed for earlier account changes.
