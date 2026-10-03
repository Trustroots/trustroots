# Design

The Android client uses the UnifiedPush connector. After a signed-in member
opts in and selects an installed distributor, it requests an endpoint with the
server's VAPID public key. The connector manages Web Push encryption keys. Its
endpoint callback uploads the endpoint URL, public key and auth secret to an
authenticated API. Endpoint changes replace the old registration. Opt-out and
sign-out remove the server registration and unregister from the distributor.

The server marks new registrations as UnifiedPush and never sends to historical
Expo, browser or Firebase records. It removes the same endpoint from any prior
account before attaching it to the current account, so a shared phone cannot
receive another member's alerts. Only HTTPS endpoints on an administrator
allowlist of public push hosts are accepted. The initial allowlist can contain
ntfy.sh; trusted self-hosted services can be added explicitly. Web Push uses
VAPID credentials held only by the server and deletes registrations rejected
as gone by the push service.

The existing unread-message job groups messages by sender and recipient and
waits ten minutes before its first reminder. Android push runs on that first
unread reminder, after the same restricted-member checks. It sends an
end-to-end encrypted payload with a generic notification title and body, no
message content or member identity, and a sender ID for navigation. The app
displays it on a Messages channel and opens that conversation when tapped.
Email remains independent of push delivery failures.

UnifiedPush requires a separate distributor app. The member-facing opt-in
explains this and offers a path to choose one. APK distribution and F-Droid
signing do not affect the push transport. No Google project, Firebase SDK or
Google Play services are required.
