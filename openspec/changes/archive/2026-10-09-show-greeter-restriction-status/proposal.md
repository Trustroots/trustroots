## Why

Greeters need to recognise suspended and shadowbanned accounts in acquisition stories before welcoming members or reviewing restricted matches.

## What Changes

- Show Suspended and Shadowbanned badges beside acquisition-story members and restricted matches.
- Return only allowlisted restriction statuses instead of full restricted-match roles.
- Preserve current profile access, moderation permissions, visibility controls and list limits.

## Impact

- Affects the admin acquisition-stories API and React view.
- Adds an additive story field and replaces the internal restricted-match roles field; update consumers together.
- No database migration or deployment configuration is required.
