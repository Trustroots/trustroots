# Website to Nostroots onboarding

The shared onboarding action appears in network settings and the community-note
modal. It opens `https://nos.trustroots.org/open/onboarding`, adding the current
viewer's encoded username when signed in. The desktop QR encodes that complete
URL locally. It does not transfer a session, secret key or verification code.

The URL starts account setup, including for someone who already has the app. It
does not yet open a particular note, author or map location. Existing browser
and direct-store links remain available. After first-time installation, members
must return to the original website link or scan the QR again.

## Related work

- [Trustroots #2802: use Nostroots links](https://github.com/Trustroots/trustroots/issues/2802)
  tracks this website integration.
- [Nostroots #289: verified HTTPS onboarding links](https://github.com/Trustroots/nostroots/pull/289)
  implements the receiving route, native declarations and static fallback.
- [Trustroots #2733: community notes](https://github.com/Trustroots/trustroots/pull/2733)
  introduced the map/profile entry points extended here.
- [Trustroots #2771: Nostroots presentation](https://github.com/Trustroots/trustroots/pull/2771)
  includes earlier presentation work.
- [Trustroots #2777: native Trustroots apps](https://github.com/Trustroots/trustroots/pull/2777)
  is related iOS/Android work, but is not a dependency. This change opens the
  separate Nostroots app (`org.trustroots.nostroots`); it does not use the mobile
  bearer API or modify the native Trustroots clients.

## Release dependencies

Keep rollout subject to these checks; a merged source PR is not proof that the
required native builds are available in the stores.

- [ ] Release iOS and Android builds containing the declarations in Nostroots
      #289. An OTA JavaScript update alone cannot add the native associations.
- [ ] Android: include the Google Play **app-signing key certificate** SHA-256
      fingerprint in `https://nos.trustroots.org/.well-known/assetlinks.json`.
      Keep the official direct APK fingerprint as well. The live response
      inspected on 12 September 2026 still contained only the preview APK
      fingerprint identified in #289.
- [ ] iOS: serve `https://nos.trustroots.org/.well-known/apple-app-site-association`
      over HTTPS without redirects, with the correct app/team identity and
      onboarding paths. The live response inspected on 12 September 2026 was
      HTTP 200 with `application/octet-stream`; configure `application/json`
      in line with [Apple's guidance](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html).
      Check Apple's cached association and test a released build.
- [ ] Verify the fallback on `nos.trustroots.org` remains deployed. Its
      trailing-slash redirect currently preserves the query string. Both
      onboarding path forms are declared by #289.
- [ ] Test a physical iPhone/iPad: app installed, app absent, first installation,
      and an existing onboarding identity. Confirm username prefill and that
      reopening the original link after installation works.
- [ ] Test physical Android devices with a Play-installed build and the official
      direct APK, plus the not-installed path and return after installation.
- [ ] Scan the website's personalised QR on both platforms. The fallback site's
      generic download QR is separate and does not preserve the username.

Verified links do not provide reliable deferred deep linking through a first
store installation. Android Play Install Referrer support is a possible future
improvement; do not promise equivalent automatic iOS continuation.

## Follow-up scope

Nostroots needs explicit allowlisted event/profile/map routes and local pending
destination state before this website can promise to return a member to the
note they selected. Do not introduce an arbitrary `destination` URL parameter.
Authenticated handoff would need a separate short-lived, single-use code flow,
ideally with PKCE, rather than credentials in these URLs.

## Measurement and testing

The onboarding anchor declares an Umami `nostroots-onboarding` click event with
only the entry point (`community-notes`, `profile-notes`, `network-settings`).
It does not send identity in event properties and works without analytics.
Completed onboarding is not measurable from a website click alone.

`qrcode-generator` is a pinned browser dependency with no runtime dependencies.
`jsqr` is a test-only independent decoder for checking the rendered QR payload.
Browser tests verify website behaviour; operating-system app-link dispatch and
store releases require the physical-device checks above.
