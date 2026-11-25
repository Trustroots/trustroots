## Why

Members can still open the unsupported Expo Android app. The signed Android preview uses a different Android application ID, so members need an explicit installation path.

## What Changes

- Show a dismissible notice in the website shell when the legacy Android app identifies itself.
- Open the current signed APK download page in the device browser through the existing app bridge.
- Explain how to sign in and when to remove the old app.

The notice ships with the website. No app release, account data migration or server changes are required.

## Capabilities

### Modified Capabilities

- `android-distribution`: Guide legacy Android users to the signed preview.
