## Why

The regular iOS offer search uses a native map and typed filters. Moving the
offer filter controls to Compose provides a shared presentation that can
continue to use the current iOS search state and navigation.

## What Changes

- Render offer type, activity, language and Circle filter controls in Compose.
- Keep Reset and Done in the native sheet toolbar and route the language action
  to the existing language catalogue.
- Preserve the rules connecting hosts to volunteering and connections-only to
  Community Notes.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the iOS offer map uses the shared offer filter controls.

## Impact

Affects shared Kotlin UI and the iOS offer filter sheet. There are no API, data
migration or deployment changes.
