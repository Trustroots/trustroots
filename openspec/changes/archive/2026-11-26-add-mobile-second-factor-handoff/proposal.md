# Complete mobile sign-in with a second factor

## Why

Staff who enable two-factor authentication need to retain access to their account in the Android and iOS apps.

## What Changes

- Let the app continue sign-in in the system browser, where members can use their authenticator, recovery code or a registered passkey.
- Return the verified member to the app using a short-lived, single-use code bound to that app's pending sign-in.
- Retain the existing password sign-in for accounts without two-factor authentication.

## Impact

Account access, mobile sessions, Android App Links and the iOS system authentication session. Passkeys continue to use the website's configured relying party and browser origin.
