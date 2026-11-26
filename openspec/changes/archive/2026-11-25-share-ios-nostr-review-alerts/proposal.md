## Why

Use shared Compose for the review alert controls in the regular iOS
Nostranslation signing sheet.

## What Changes

- Render the review alert action and status using Compose for accounts with
  a connected client.
- Connect the action to the iOS alert manager for permission, registration and
  account scoping.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS signing sheet shares its review alert
  presentation.

## Impact

The iOS signing sheet hosts the shared alert presentation and delegates the
notification work to the platform manager.
