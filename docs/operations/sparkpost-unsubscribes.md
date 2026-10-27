# SparkPost newsletter unsubscribe handling

The existing `POST /api/sparkpost/webhook` endpoint handles SparkPost's
`list_unsubscribe` (email client unsubscribe control) and `link_unsubscribe`
(tagged unsubscribe link) events. Both withdraw the matching member's community
newsletter consent; other email and notification preferences remain unchanged.

## Deployment

1. Enable `sparkpostWebhook.enabled` and configure a dedicated username and
   password through deployment configuration.
2. Configure the SparkPost event webhook to send both unsubscribe event types to
   `https://www.trustroots.org/api/sparkpost/webhook`, using HTTPS and the matching
   HTTP Basic authentication credentials. Add these types to any existing event
   subscription that uses this endpoint.
3. Send a test unsubscribe for a controlled member address and verify that its
   newsletter checkbox is cleared and it is excluded from newsletter exports.

The endpoint responds with 200 after preference updates complete. Persistence
failures return 503 so SparkPost can retry; repeated opt-outs are harmless.
Metrics failures do not prevent newsletter opt-outs. Unknown recipients and
invalid addresses are ignored. Only the current account email is matched;
pending email changes are not used.

This handles newly delivered events. It does not poll SparkPost or import past
unsubscribes. Historical opt-outs need a separate reconciliation before any
newsletter export that relies on those older preferences. SparkPost suppression
remains independent of the local preference; changing the checkbox does not
remove a provider suppression.

See SparkPost's [unsubscribe guide](https://support.sparkpost.com/docs/user-guide/setting-up-unsubscribe-links)
and [webhook API](https://developers.sparkpost.com/api/webhooks/) for event
subscription and delivery details.
