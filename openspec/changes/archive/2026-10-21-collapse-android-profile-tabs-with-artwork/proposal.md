# Collapse Android profile tabs with artwork

## Why

Issue #3234 requires tall Android headers to occupy a single row after scrolling. The native profile currently keeps its section tabs visible in the collapsed artwork header, leaving a two-row header and conflicting with that requirement.

## What changes

- Collapse a profile to its inset-aware action row alone.
- Keep section tabs in the expanded artwork header, outside the pager; clip them from view at full collapse and reveal them again as the member scrolls downward.
- Preserve the selected section, pager swiping, content scroll positions, profile actions, and artwork behind the action row.
- Update the Android profile-frame contract and UI journey coverage.

## Impact

Changes are limited to Android profile presentation, its UI journeys, and the living `native-android-member-app` specification. There are no API, data, migration, or deployment changes.
