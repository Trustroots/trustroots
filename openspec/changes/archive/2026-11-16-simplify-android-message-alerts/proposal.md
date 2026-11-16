## Why

Android message alerts currently require a separate distributor app. Members with Google Play Services should be able to opt in from Messages without installing another app. See GitHub issue #3623.

## What Changes

- Offer a dismissible message-alert opt-in in the Android inbox.
- Bundle UnifiedPush's open-source FCM distributor in release builds. Keep the existing selection for external distributors and use the bundled one automatically when no external distributor is installed and Play Services is available.
- Keep external UnifiedPush support on phones without Play Services.
- Document release configuration and test real delivery on a locked phone.

## Impact

- Affected specs: native-android-member-app, member-notifications
- Affected code: Android inbox and message alert enrolment, signed APK build configuration
- Deployment: verify Trustroots Web Push is configured and allows the embedded distributor's endpoint before testing release delivery
