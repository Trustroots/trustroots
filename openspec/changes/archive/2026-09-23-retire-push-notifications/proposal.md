# Retire push notifications

## Why

Browser and mobile push delivery has been disabled since April 2026 because it
did not work. The Expo mobile application is retired, and browser FCM is unused
in practice. Keeping the Firebase and Expo stacks adds maintenance cost without
product value. Push can be rebuilt later if there is clear demand.

## What Changes

- Remove Expo and Firebase client/server packages and adapters.
- Remove the push service-worker build, FCM config endpoints, and browser
  service-worker registration.
- Stop registering the Agenda push-delivery job and remove the push service and
  unreachable sender.
- Reject all new push registrations; keep the removal endpoint and historical
  `pushRegistration` fields on member profiles (no data migration).
- Stop queuing push side-effects from messaging and experiences; leave email
  notifications unchanged.
- Drop push-registration counts from daily statistics and retire related tests
  and end-to-end coverage.

## Impact

Members can no longer add push devices. Existing stored tokens remain on
profiles and can still be removed. Email notifications continue as today. Native
apps may introduce a new push design later without depending on this stack.
