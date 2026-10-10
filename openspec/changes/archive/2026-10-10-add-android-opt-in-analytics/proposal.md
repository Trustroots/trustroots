# Opt-in Android usage analytics

## Why

Trustroots needs aggregate Android usage counts in its existing self-hosted Umami service. Members must choose to participate before the app sends any native analytics.

## What changes

- Add a locally stored, initially disabled usage analytics preference on sign-in and Account screens, including F-Droid builds.
- Count foreground app opens and native top-level screen views through cookie-free requests to `https://1p.trustroots.org/api/send`.
- Use the existing production website identifier, with `android.trustroots.org` and fixed `/android/` paths to distinguish native traffic.
- Exclude account data, messages, search inputs, coordinates, browser URLs, credentials and persistent identifiers. Stop pending analytics when consent is withdrawn.

## Impact

Android only; no server migration, new SDK or dependency. Analytics failures must not affect navigation or authentication. This requires a future Android release; the existing F-Droid submission continues to target the already published release. Native instrumentation and unit tests cover consent, payloads and delivery. Browser e2e tests cannot exercise native preferences or networking.
