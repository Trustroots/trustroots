## Why

Members need to share clickable links to Trustroots services such as the app page on team.trustroots.org.

## What Changes

- Allow HTTP and HTTPS links to Trustroots subdomains in message bodies and draft previews.
- Keep external destinations as plain text.

## Capabilities

### Modified Capabilities

- `messaging`: Extend the existing Trustroots message link allowlist.

## Impact

The core client rich-text renderer applies the rule for the messages module, including previously stored messages. No data migration or deployment configuration is required.
