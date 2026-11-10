## Why

Android signup currently loses form input when leaving the rules page, and the web onboarding flow does not hand off to the signed-in app.

## What Changes

- Collect account details in a native Android form and use the existing account creation and mobile sign-in endpoints.
- Keep the form in the navigation stack while the rules are open.
- Offer the native profile editor and a direct route into the app after signing in.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: Native Android signup and onboarding.
