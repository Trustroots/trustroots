# Remove artificial Android startup waits

## Why

Members prefer the app to open as soon as session restoration finishes. A greeting must not delay access to messages or sign-in.

## What Changes

- Remove the signed-in greeting delay and signed-out startup minimum.
- Show startup only while session loading is pending, then publish the restored session and completed state together.
- Fade the startup overlay out over 180 ms while the ready destination is already rendered and interactive. Use Compose animation scaling.
- Retain fresh-sign-in Messages, restored destinations, sign-up onboarding and cancellation safeguards.

## Impact

Android startup state and its tests only. No session storage, authentication or dependency changes.
