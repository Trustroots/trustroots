## Why

Move the regular iOS report sheet's target, action and feedback presentation to shared Compose as part of #3232.

## What Changes

- Show the reported member, send action, error and confirmation in shared Compose.
- Keep the native report editor, keyboard Done action, support request and sheet dismissal.
- Preserve the privacy and urgent-safety guidance in the report form.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS report sheet uses shared Compose for its target and feedback.

## Impact

The iOS report sheet presentation changes. No API, data or Android dialog changes are required.
