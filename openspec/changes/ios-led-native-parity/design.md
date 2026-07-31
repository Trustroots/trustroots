## Context

Trustroots has separate native iOS and Android applications. The iOS
application currently covers more of the member experience and therefore
contains product and presentation decisions that Android can use as a
reference. The applications use different native UI frameworks and platform
security facilities, so parity cannot mean sharing implementation or copying
pixels.

Both applications consume the established website-session API. Their
member-facing outcomes, information hierarchy and safety behaviour should
converge even when navigation controls, keyboard handling, accessibility
semantics or lifecycle details differ by platform.

## Goals / Non-Goals

**Goals:**

- Make the source of truth for shared native product decisions explicit.
- Keep Android work connected to relevant iOS product changes.
- Preserve Android-native interaction, accessibility and lifecycle behaviour.
- Record deliberate platform differences instead of allowing accidental drift.
- Apply the workflow first to Android sign-in and surrounding shell behaviour.

**Non-Goals:**

- Pixel-identical layouts or a shared cross-platform UI framework.
- Automatic applicability of every iOS implementation detail to Android.
- Blocking an iOS release until every applicable Android change ships.
- Replacing the platform-specific native application proposals.
- Redesigning the existing website-session API.

## Decisions

### iOS is the product reference, not a pixel template

Use the latest accepted iOS behaviour as the default reference for shared
member-facing flows, content hierarchy, terminology, states and safety
outcomes. Android implementations retain Android conventions for navigation,
system back behaviour, keyboard and inset handling, permissions,
accessibility, storage and lifecycle.

When an existing shared specification or server policy conflicts with an iOS
implementation, the specification and server policy remain authoritative. The
iOS behaviour must not silently redefine security, eligibility or visibility
rules.

### Every material iOS change receives a parity classification

An applicable iOS proposal or implementation plan records one of:

- **Exact parity:** the member-visible behaviour and presentation can be
  reproduced without a meaningful platform difference.
- **Android-native adaptation:** the same member outcome and information
  hierarchy use an Android-specific interaction or component.
- **Not applicable:** the behaviour depends on iOS-only platform capability or
  has a documented product reason not to exist on Android.

The classification includes a short rationale and, for applicable work, an
Android task or follow-up reference. Classification does not require the two
platform releases to be simultaneous.

### Parity is verified through outcomes and representative states

Review parity using the relevant states of a journey: loading, success, empty,
validation, error, keyboard, small-screen and accessibility behaviour where
applicable. Automated tests cover stable logic and interaction contracts.
Visual comparison and device testing cover hierarchy and platform presentation
that would be brittle or misleading in a unit test.

### Initial Android parity slices

The signed-out slice aligns the Android shell with the reference native
experience:

- present the sign-in content above the vertical centre and allow it to scroll;
- respect safe drawing insets and the on-screen keyboard;
- show a stable `yyyy-MM-dd HH:mm` build timestamp;
- omit the configured API origin from the signed-out screen;
- retain the API origin in the signed-in menu for diagnostics.

The same slice makes Android session establishment robust when a response
contains both a routing cookie and the signed `connect.sid` member-session
cookie. Android examines all `Set-Cookie` response values and stores the
`connect.sid` cookie rather than assuming the first cookie is the member
session.

The first signed-in slice replaces the temporary top icon row and placeholder
content with the reference four-destination shell:

- keep Circles, Search, Messages and Menu in a persistent labelled bottom
  navigation bar;
- retain a compact Trustroots brand header at the top;
- load and display the established circle list;
- render authorised accommodation offers on an interactive native map centred
  on the same initial Lisbon region as iOS;
- load and display the established conversation inbox;
- provide loading, empty, error and retry states without falling back to the
  website.

Android uses MapLibre Native as the maintained native map renderer and an
explicit public map style. Map content carries its required attribution. The
Trustroots API remains the authority for which offers are returned; the map
does not download an unrestricted member dataset or filter visibility locally.
MapLibre is wrapped in Compose with lifecycle forwarding rather than placing a
web map in a `WebView`.

## Risks / Trade-offs

- [Android becomes a delayed copy of iOS] → Track parity as a product outcome
  and allow Android-native adaptations rather than copying implementation.
- [The reference contains an iOS defect] → Keep accepted specifications and
  server policy authoritative and review reference behaviour before porting it.
- [Parity classifications become paperwork without delivery] → Require an
  Android task or follow-up reference for applicable material changes.
- [Small presentation changes create brittle tests] → Automate stable
  behaviour and use focused device or visual review for layout hierarchy.
- [Platform divergence is hidden as adaptation] → Require a short rationale
  whenever parity is not exact.

## Migration Plan

1. Validate and accept the shared parity contract.
2. Deliver the signed-in bottom navigation and API-backed destination slice.
3. Verify the Android slices with unit tests, lint and representative device
   layouts.
4. Add parity classifications to future material iOS native changes.
5. Triage remaining iOS-only MVP areas into Android tasks as each Android
   member journey is implemented.

No data migration or coordinated server deployment is required. Rolling back
the initial slice requires only an Android application rollback.

## Open Questions

- Should parity classifications later be enforced through a pull-request
  template once the workflow has been used on several changes?
- Which representative Android device sizes should form the maintained visual
  parity review set?
