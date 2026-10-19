## Why

Remove the unused external message-classification integration. Its results do not control message delivery or moderation, and normal messaging must continue without it.

## What Changes

- Remove the Akismet client dependency, configuration, service and provider-specific tests.
- Send messages without external classification or new spam flags.
- Preserve existing message records, historical spam flags, statistics compatibility, notifications and manual moderation.
- Retire obsolete integration documentation and update the runtime and messaging specifications.

## Impact

Affected modules: core, messages and runtime configuration. No database migration is required. Existing deployment configuration may retain the unused provider settings until operators remove them. API response shapes, delivery rules and restriction handling remain unchanged.
