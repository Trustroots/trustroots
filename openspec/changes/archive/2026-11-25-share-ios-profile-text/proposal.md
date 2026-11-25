## Why

Move the regular iOS profile biography and languages to shared Compose. The
biography component also serves the existing Compose profile pilot.

## What Changes

- Render the biography and language list inside the regular iOS profile scroll view.
- Use the existing plain-text conversion and local language catalogue.
- Size each section to its content so long biographies wrap without clipping.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS profile uses shared Compose for biography and languages.

## Impact

The iOS presentation and shared Kotlin UI change. No API or data changes are required.
