# Record members' last active IP addresses

## Why

Administrators cannot currently identify accounts that most recently used the
same network address. A single, current IP address will provide useful
moderation context without retaining a member's address history.

## What Changes

- Store the exact client IP address that a signed-in member most recently used.
  The existing last-seen timestamp remains rate-limited, while an address is
  updated immediately when it changes.
- Show the stored IP address in administrator member-search results and on a
  member's report card.
- Let administrators open an exact-match list of members whose current stored
  IP address is the selected address.
- Explain this collection, purpose, access, and retention in the privacy
  policy.

## Impact

- Affects the user model and authenticated activity middleware, administrator
  member search APIs and views, and the privacy-policy page.
- The new optional field requires no data migration; accounts receive a value
  after their next qualifying authenticated activity.
- The account-deletion flow removes the field with the member record. No IP
  history is retained.
- Production Nginx restores Cloudflare visitor addresses only from Cloudflare's
  published networks before Passenger provides its trusted client-address
  header. Otherwise Express's socket-derived client address is used.
