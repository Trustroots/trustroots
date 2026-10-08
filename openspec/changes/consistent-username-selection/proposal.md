# Consistent username selection with existing-account compatibility

## Why

Signup, availability checks and username changes currently disagree about punctuation. Non-string input can reach coercion and truthiness guards. Newly reserved names also prevent existing members from saving unrelated profile changes or resolving NIP-05 identities.

## What Changes

- New accounts and username changes accept 3–34 ASCII letters and digits, including at least one letter; uppercase input remains accepted and stored lowercase.
- Reject explicitly supplied non-string usernames at signup, availability and profile update boundaries.
- Preserve unchanged existing usernames, including punctuation, digits-only and reserved names, for saves, sign-in, profile lookup and NIP-05.
- Keep model validation for new/changed usernames and the existing change cooldown; update React feedback and regression coverage.

## Impact

Authentication, account settings, the user model and NIP-05 are affected. New username punctuation and digits-only selections become invalid. No existing account is renamed and no migration or deployment configuration is required. First/last-name policy and reserved-name configuration remain unchanged. This extracts the agreed remaining work from #2726 by replacing its stale implementation against current main.
