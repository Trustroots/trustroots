## Why

Android message alerts currently follow the email reminder schedule, which can delay time-sensitive meetup messages. Members also need a way to check delivery with their phone locked.

## What Changes

- Send native UnifiedPush alerts promptly after an eligible message is saved.
- Let Android members request a test alert for the current device, due after 15 seconds.
- Keep the existing email schedule and UnifiedPush setup.

## Impact

Affects the Android app, users and messages modules, and background worker. Existing push registrations remain valid. Deploy the updated API and worker before offering the test in a new APK.
