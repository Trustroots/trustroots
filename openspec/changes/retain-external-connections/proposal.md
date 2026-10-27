## Why

Staff lose external profile identifiers when members replace or remove links.
Retaining private history lets admin and support teams investigate past connections.

## What Changes

- Record additions, replacements and removals for hospitality networks, Nostr and legacy social identities atomically with profile changes.
- Backfill current connections with an explicitly unknown original date.
- Show private history on admin and support member pages and provide exact cross-member identifier search.
- Delete history with the account and exclude it from ordinary profile responses.

## Impact

- Affected specifications: member-profiles, admin-moderation.
- Affected modules: users, admin and shell route registration.
- Deploy tracking before running the idempotent backfill and provision the search index. Existing profile APIs remain compatible; new read endpoints require admin or support-team.
