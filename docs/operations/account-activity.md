# Account activity history deployment

Account activity is stored separately from member profiles. The collection
keeps only event type, owner and timestamp. It does not store credentials,
action tokens, session-store IDs, IP addresses, browser fingerprints or
message content.

Recording is best-effort: the write path retries once immediately on failure
and does not sleep in the request. Session creation keeps a stable event id in
the session so a later request can retry if the first write failed. Other
account transitions log a storage error and continue.

The API returns events from the last 90 days. MongoDB TTL deletion is
asynchronous, so expired records can remain briefly in storage after they stop
appearing in history. Production has
Mongoose automatic index creation disabled; create the indexes before
deploying the application version which reads this collection:

```sh
npm run ensure-indexes -- AccountActivity
```

The index command creates a TTL index on `createdAt` and a member/timestamp
index for paginated history reads. Account removal deletes the member’s
activity rows as part of the removal flow. Activity history is not
reconstructed for earlier account changes.
