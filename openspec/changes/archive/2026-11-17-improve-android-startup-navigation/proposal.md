# Improve Android startup and sign-in navigation

## Why

The personalised cold-start greeting can flash after slow session restoration, and members want to reach messages directly after signing in (Refs #3683).

## What Changes

- Keep the returning member greeting visible for approximately two seconds after restoration publishes the member name.
- Retain the existing signed-out startup minimum and Activity-scoped cancellation/recreation behaviour.
- Open Messages after a fresh sign-in while preserving restored navigation, onboarding and explicit message destinations.

## Impact

Android session startup timing and initial authenticated navigation only. No API, session storage or dependency changes.
