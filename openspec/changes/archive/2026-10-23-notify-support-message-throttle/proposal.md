# Notify support when messaging is throttled

## Why

Support needs a timely indication that a member has reached the existing
distinct-recipient sending limit.

## What Changes

- Queue a plain-text email to the configured support inbox on a throttle hit.
- Limit alerts to one per member in a rolling 24-hour window using an atomic
  MongoDB claim shared across application instances.
- Include the member's username, admin profile link, timestamp, recipient count
  and configured limit, without message contents or recipient identities.
- Release the claim if email queuing fails and retain the existing HTTP 429.
- Preserve the sending policy, role exemptions and automatic window expiry.

## Impact

The messages module gains a small alert service and collection, and a text email
template in core. Existing module dependencies suffice. No migration or new
configuration is required: the collection uses MongoDB's built-in unique `_id`
index and the existing email worker and support address. The claim and queue
write are separate operations: a process interruption between them can delay an
alert until the next 24-hour window. SMTP delivery retains existing queue semantics.
