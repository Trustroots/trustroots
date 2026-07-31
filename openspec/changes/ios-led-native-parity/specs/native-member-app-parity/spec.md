# Native Member App Parity Specification

## Purpose

Keep the iOS and Android member applications aligned in product outcomes while
preserving appropriate native conventions on each platform.

## ADDED Requirements

### Requirement: iOS-led native product parity

The native member applications SHALL treat the latest accepted iOS
member-facing behaviour as the default reference for shared native flows,
information hierarchy, terminology and states. Shared specifications and
server-side security, eligibility and visibility policies SHALL remain
authoritative when they differ from an application implementation.

#### Scenario: A shared native journey is implemented on Android

- **WHEN** Android implements a member journey that already exists on iOS
- **THEN** Android provides the same member outcome and information hierarchy
- **AND** follows the applicable shared specifications and server policies
- **AND** may use Android-native interaction and lifecycle conventions

#### Scenario: Reference behaviour conflicts with an accepted policy

- **WHEN** an iOS implementation differs from an accepted shared specification
  or server-side policy
- **THEN** the shared specification or server-side policy remains authoritative
- **AND** Android does not reproduce the conflicting behaviour merely for
  parity

### Requirement: Native parity classification

Each material member-facing iOS product change SHALL classify its Android
parity as exact parity, Android-native adaptation or not applicable. The
classification SHALL include a rationale and applicable work SHALL identify an
Android task or follow-up reference.

#### Scenario: The same behaviour applies directly to Android

- **WHEN** an iOS change has no meaningful platform-specific difference
- **THEN** the change records exact Android parity
- **AND** identifies the Android delivery task or follow-up

#### Scenario: Android conventions require a different interaction

- **WHEN** the iOS outcome applies but its interaction is platform-specific
- **THEN** the change records an Android-native adaptation
- **AND** explains how the Android interaction preserves the member outcome

#### Scenario: An iOS change does not apply to Android

- **WHEN** a change depends on an iOS-only capability or has another documented
  product reason not to exist on Android
- **THEN** the change records that Android parity is not applicable
- **AND** includes the reason

### Requirement: Outcome-based parity verification

Applicable native parity work SHALL verify the relevant journey states and
SHALL use automated tests for stable behaviour contracts. Platform layout and
interaction MAY use focused device or visual review where automated comparison
would be brittle.

#### Scenario: A native parity slice is ready for review

- **WHEN** applicable Android parity work is completed
- **THEN** the relevant loading, success, empty, validation and error states are
  compared with the reference journey
- **AND** keyboard, constrained-display and accessibility behaviour are checked
  when relevant
- **AND** stable logic and interaction contracts have automated regression
  coverage
