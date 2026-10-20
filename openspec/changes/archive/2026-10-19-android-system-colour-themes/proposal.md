## Why

The native Android app currently uses a single light Compose palette and light
system bars, even when Android is in dark appearance. Several screens also use
hardcoded white or pale-green surfaces, which can become unreadable when the
app adopts a dark palette. Moving the brand colours into Android resources and
providing matching night values gives native screens consistent, readable
light and dark presentation.

## What Changes

- Define the Trustroots brand palette in XML colour resources, with default and
  `values-night` variants.
- Build Compose light and dark colour schemes from those resources and follow
  the Android system appearance setting.
- Apply matching Android system bar colours and icon contrast, while keeping
  automatic platform force-dark disabled.
- Update native surfaces and text that currently assume a light background so
  shared controls remain readable in both appearances.
- Keep host map result sheets white in both appearances, with an explicit
  light content scheme for their text and controls.
- Document system-following appearance in the Android README.
- Add Android UI journeys covering light and dark palettes, system appearance
  changes, representative screens and controls, and the white host card.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: provide readable native light and dark themes
  that follow system appearance, preserving the host result card's white
  presentation.

## Impact

- Changes `apps/android` resource colours, Compose theme wiring, affected UI
  surfaces, Android UI tests and README guidance.
- Does not change navigation, ViewModels, forms, map marker or circle data
  colours, server routes, or iOS presentation.
- Requires no data migration, backend change or deployment configuration.
