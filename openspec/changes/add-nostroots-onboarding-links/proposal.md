# Add Nostroots onboarding links

## Why

Trustroots members already discover Nostroots through community notes and network
settings, but the existing links lose their username or send them straight to an
app store. Trustroots/nostroots#289 supplies a verified HTTPS onboarding route;
Trustroots/trustroots#2802 tracks using that route from this website.

## What Changes

- Add a shared, translated onboarding action to the Nostroots action modal and
  above the public-key field in network settings.
- Build a fixed HTTPS onboarding URL with only the signed-in viewer's encoded
  username; signed-out visitors receive the same route without a username.
- Generate a desktop QR locally from the complete onboarding URL, and explain
  account setup and returning to the original link after installation.
- Retain browser and direct-store alternatives. Record aggregate onboarding
  clicks by entry point without including usernames or keys in event properties.
- Extend client and browser coverage, including viewing another member's notes.

## Impact

Affected areas: core React components, profile network settings, community-note
entry points, English translations, client dependencies and e2e tests. No server
API, database migration, authentication handoff or native app change is required.

Release depends on the Nostroots site associations and native builds from #289:
Google Play's app-signing fingerprint must be registered separately from the
direct APK certificate; iOS requires a valid AASA response and a released build
with the associated domain. Physical-device checks remain a release dependency.
The draft PR will document these prerequisites and link the relevant issues/PRs.

Event/profile/map destinations and continuation after onboarding are future
Nostroots work. General navigation and existing browser destination links remain
unchanged. The separate Trustroots native apps in Trustroots/trustroots#2777 are
related work, not a dependency of this website-to-Nostroots integration.
