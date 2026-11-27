# Migrate iOS member search to Compose

## Why

The iOS member search is the remaining SwiftUI presentation for a common member
journey, while other member-facing areas are moving into shared Compose UI.
Keeping search in the shared module makes its loading, filter and result states
consistent across mobile clients while preserving the existing iOS host API.

## Scope

- Move the member search screen presentation into shared Compose.
- Keep member search transport and authentication owned by the iOS gateway.
- Preserve query and results while opening a profile or switching between
  member and offer search modes.
- Keep filters, keyboard submission and dismissal, accessible labels, result
  selection, retry, and filter-triggered refresh behaviour.
- Cover initial, loading, empty, populated and failed states in shared tests and
  the iOS fixture journey.

## Compatibility

The iOS search destination and existing `TrustrootsAPI.searchMembers` request
remain the integration boundary. No server contract or stored data changes.
Search state is retained for the lifetime of the iOS root view and is not
persisted across app launches.

## Affected areas

- `apps/shared`: shared Compose search presentation and state.
- `apps/ios`: host gateway, Compose controller and UI journey coverage.
- `openspec/specs`: shared mobile member API behaviour and tests.

## Deployment and migration

No server deployment or data migration is required. The change ships with the
existing iOS app and shared Kotlin framework.
