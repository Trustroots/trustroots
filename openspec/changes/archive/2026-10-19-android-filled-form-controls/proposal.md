## Why

Android member forms currently use outlined inputs with inconsistent spacing.
Filled inputs and regular vertical gaps will make profile editing, hosting,
experience sharing, account details and message composition easier to scan.

## What Changes

- Standardise editable Android member form inputs on Material 3 filled text fields.
- Give vertically adjacent form fields consistent spacing while preserving
  each form's validation, entered values, focus, keyboard actions, loading state
  and unsaved-change protection.
- Move the labels and accessibility text of the affected fields into Android
  string resources.
- Cover the filled appearance, labels and field spacing in Android UI tests.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: define consistent presentation and accessibility
  for editable member form fields.

## Impact

- Updates native Compose UI in `apps/android` and the Android string resources.
- Updates Android Compose UI regression tests.
- Does not change server APIs, stored data, search/filter controls, navigation,
  or iOS behaviour.
