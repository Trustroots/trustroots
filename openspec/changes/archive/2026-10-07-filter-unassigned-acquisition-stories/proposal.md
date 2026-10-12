# Filter unassigned acquisition stories

## Why

Administrators and greeters need to find members who have not yet been assigned a greeter without scanning contacted rows.

## What changes

- Add an unchecked “Unassigned only” checkbox above the acquisition stories table.
- When checked, show only loaded members whose Greeter column is Unassigned, preserving the selected sort order.
- Restore all loaded stories when unchecked and show a clear empty state if no unassigned members remain.

## Impact

Only the admin acquisition-stories client view changes. The filter applies within the existing latest 500 stories. Existing permissions and API responses remain compatible; no migration or deployment changes are required. Add client and end-to-end regression coverage; server behaviour is unchanged.
