## Why

The shell now owns client composition, but feature components still reach its settings/bootstrap hooks and browser navigation through core re-export shims. Those hidden upward dependencies prevent enforcing the module/layer boundary tracked by #3358.

## What Changes

- Give core ownership of the feature-facing bootstrap context, types, hooks and browser-navigation primitive.
- Keep provider composition, reading window bootstrap data, routing and page layout in the shell. The shell consumes the core context just as it consumes core authentication.
- Update every current source, test and tooling consumer directly, then remove the seven obsolete core-to-shell re-export files.
- Preserve state identity, URLs, navigation behaviour, application coverage and all existing end-to-end journeys.

## Impact

This is an internal ownership refactor on top of the shared-package boundary guard PR. It changes internal import paths, so overlapping branches that introduce old-path imports must update them when rebasing. Existing repository consumers are updated in this change. There is no external API, deployment or data change. Existing integration and browser tests cover the unchanged behaviour; no new user-facing functionality requires a new browser journey.
