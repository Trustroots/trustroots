## Why

Android profiles lack the Block/Unblock and Report member actions already available in the native iOS app. Add these existing member controls to Android before sharing the profile journey under #3232.

## What Changes

- Add native Block/Unblock confirmation and a report form to another member's profile overflow menu.
- Retrieve current blocking state separately from profile content; show loading, retry and error states without treating failed lookups as a confirmed unblocked state.
- Hide the profile's message action after a confirmed block, restore it after successful unblock, and preserve confirmed state after failed mutations.
- Retain report text through failed submissions and Activity recreation; clear private drafts and pending work when the account or backend changes.
- Reuse authenticated blocked-member and support routes without server changes.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: member safety controls within the native profile journey.

## Impact

Android API adapters, entry-owned profile state, profile UI, string resources and native tests change. Existing server permissions and blocking rules remain authoritative. No API changes, database migrations, new permissions, dependencies or production configuration are required.
