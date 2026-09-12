# Add Welcome team access

## Why

Welcome team members need acquisition stories and analysis without broader administrator access.

## What Changes

- Add the `welcome-team` role with access to both acquisition pages and APIs.
- Allow administrators to grant and revoke the role from member role management.
- Adapt navigation and member links for limited access while preserving all acquisition data.

## Impact

Affected areas: user roles, administrator APIs and UI, Angular and React route guards. No migration or automatic grants. Existing role-change requests continue to add roles by default.
