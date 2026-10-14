# Define expiring single-use email confirmations

## Token lifecycle

Store a digest together with issuance and expiry timestamps and the address being confirmed. New links expire after 24 hours. Issuing a resend, reminder or changed-address link replaces the current token and timestamps atomically.

Confirmation uses a compare-and-set update matching the token digest, pending address and unexpired timestamp. The update applies the address/publication change and removes the token metadata in the same operation. Only one caller succeeds. A reminder must never recreate metadata after confirmation or overwrite a more recent pending change.

## Legacy transition

Use a configured deployment cut-off plus a seven-day grace period for outstanding links without expiry metadata. Legacy acceptance must remain bounded across restarts and multiple application instances; do not calculate the deadline from each process's start time. After the grace period, offer a fresh resend flow. Coordinate digest-format lookup with the existing account action token proposal.

## Responses and sessions

Expired or consumed links receive the existing invalid-link outcome with a clear resend route. Validation GET requests never consume links. Email confirmation retains the established MFA session policy and does not create a verified MFA session.

## Validation

Test the exact expiry boundary, concurrent consumption, replacement, reminder races, changed pending addresses, legacy grace before/after the cut-off, GET idempotence and preservation of MFA restrictions. Add a browser resend-and-confirm flow using anonymous members.
