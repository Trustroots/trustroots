## Why

Issue #3234 combines Android architecture, navigation and presentation work that
must be delivered through focused changes. `MemberJourneys.kt` still combines
member search, profile detail, profile editing, inbox, conversation and contacts,
making later state and navigation changes difficult to review independently.

## What Changes

- Split those six screens into named packages below `ui`, with one source file
  per screen and separate profile sections and actions.
- Place components and helpers shared by the extracted screens in `ui/common`.
- Update production and test imports without changing screen behaviour, state
  ownership, callbacks, accessibility labels, layout or API traffic.
- Keep existing Android journeys and coverage requirements intact.

This is the first structural slice of #3234. Screen ViewModels, Navigation 3,
resources, themes and visual changes remain separate follow-ups. Reported UI
bugs must be reproduced against the current app before changing their behaviour;
this source move does not claim to fix or reproduce them.

## Impact

Only `apps/android` Kotlin source organisation and its documentation change.
There are no new dependencies, API changes, data migrations or deployment steps.
The web and iOS apps are unaffected.
