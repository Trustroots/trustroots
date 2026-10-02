# Trustroots for Android

This is the native Kotlin and Jetpack Compose sibling of the Trustroots iOS
member app. It intentionally shares the existing policy-protected Trustroots
JSON routes with iOS while keeping its UI and lifecycle Android-native.

## Open in Android Studio

Open `apps/android`, select a JDK 17 runtime and install Android SDK 37 when
prompted. The debug build uses `https://www.trustroots.org` by default.

To use another API server:

```sh
./gradlew installDebug -PtrustrootsApiUrl=https://www.trustroots.org
```

For an API running on the development Mac, use the Android emulator host alias:

```sh
./gradlew installDebug -PtrustrootsApiUrl=http://10.0.2.2:13001
```

Release builds are fixed to `https://www.trustroots.org`.

## Android preview distribution

The [GitHub release workflow](../../.github/workflows/android-preview-release.yml)
publishes a signed APK as a prerelease after a successful Android build on
`main`. The [Obtainium link](../../README.md#android-preview) imports this source
with prereleases enabled. Keep publishing updates with the same Android signing
key and increasing version codes so existing installations can update.

| Channel | How updates reach members | Trustroots status |
| --- | --- | --- |
| [GitHub Releases](https://github.com/Trustroots/trustroots/releases) | Download the signed preview APK directly | Publishing previews |
| [Obtainium](https://obtainium.imranr.dev/) | Watches GitHub prereleases for newer APKs | Import link in the root README |
| [Zapstore](https://zapstore.dev/) | Lists and updates the project-signed GitHub APK | Configured; first Nostr publication and signing-certificate link remain |
| [F-Droid](https://f-droid.org/) | Builds from source and distributes updates after review | Listing assets and a draft recipe prepared; build validation and submission remain |
| [IzzyOnDroid](https://apt.izzysoft.de/fdroid/) | Indexes upstream APK releases | No submission planned under its current inclusion policy |
| [Google Play](https://play.google.com/store) | Distributes updates through Play App Signing | Requirements documented below; no Play release prepared |

The repository's [Zapstore configuration](../../zapstore.yaml) selects those
Android preview APKs. To check the source without publishing:

```sh
zsp publish zapstore.yaml --pre-release --channel beta --check
```

The public Trustroots Nostr key is in `zapstore.yaml` for Zapstore's repository
verification. Commit that configuration before the first publication. A project
publisher can then sign and publish from the repository root:

```sh
zsp publish zapstore.yaml --pre-release --channel beta
```

Zapstore's first publication also needs a one-time link between the project
Nostr identity and the Android signing certificate. Keep the Nostr private key,
Android keystore and their credentials outside the repository. After the first
publication succeeds, set the GitHub Actions secret `ZAPSTORE_SIGN_WITH` to a
project-controlled NIP-46 bunker URL and the repository variable
`ZAPSTORE_PUBLISH_ENABLED` to `true`. The Android preview workflow will then
publish each new APK to Zapstore after creating its GitHub prerelease.

The [F-Droid submission draft](../../distribution/fdroid/README.md) includes
the source build recipe and next steps. Submit it after a release containing
the upstream Fastlane listing files has been published and its build has been
validated in F-Droid's environment.

### Google Play requirements

Publishing on Google Play would require a verified
[Play Console account](https://support.google.com/googleplay/android-developer/answer/6112435)
with its one-time US$25 registration fee, a release Android App Bundle (`.aab`),
and [Play App Signing](https://developer.android.com/guide/app-bundle/faq).
The current workflow publishes an APK, so it would need an AAB upload path.
The project's signing key must be planned with Play App Signing if existing
GitHub APK installations should receive Play updates. Because the package
`org.trustroots.android` is already distributed outside Play, the publisher
may need to [prove ownership of its signing key](https://developer.android.com/developer-verification/guides/google-play-console).

The publisher would also need to complete the
[store listing and app-content declarations](https://support.google.com/googleplay/android-developer/answer/9859455):
graphics and screenshots, privacy policy, Data safety information, content
rating, target audience, and reviewer access to the signed-in parts of the app.
For a new *personal* developer account, Google requires a
[closed test with at least 12 opted-in testers for 14 continuous days](https://support.google.com/googleplay/android-developer/answer/14151465)
before applying for production access. The app's current target SDK is 37,
above the [API 36 minimum for new phone apps](https://support.google.com/googleplay/android-developer/answer/11926878)
as of October 2026.

We will not submit the Android app to IzzyOnDroid. We respect its current
[app inclusion policy](https://izzyondroid.org/docs/general/AppInclusionPolicy/),
including its criteria concerning AI-generated code, and will not seek an
exception for this app.

## Build and verify locally

The app deliberately uses the light Trustroots colour scheme regardless of the
device appearance setting. With Android Studio's bundled JDK selected, run:

```sh
./gradlew testDebugUnitTest lintDebug assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`. The
sign-in screen shows its build date; the signed-in menu also shows the exact API
server in use.

The native Android app currently supports sign-in, circle browsing and
membership with artwork, map-based host search, username search and profile
viewing and editing with pictures and hosting details, inbox and conversation
messaging, and account sign-out. Experiences and the remaining account features
are still being built. The host map uses
OpenStreetMap tiles with visible attribution and a local tile cache. To use
Mapbox Streets tiles in a build, provide a public token authorised for this
Android app without committing it:

```sh
TRUSTROOTS_MAPBOX_TOKEN=pk.your-token ./gradlew assembleDebug
```

The same token can be set with `-PtrustrootsMapboxToken=...`. Without a token,
the app uses OpenStreetMap tiles. The app also keeps a small encrypted,
account-scoped offline cache of recent map results, up to three inbox pages and
the latest 100 messages in up to twelve recently opened conversations,
the member's own profile and eight recently viewed profiles. It labels saved
data when a network failure triggers the offline fallback. Circle images have
a separate, limited disk cache. Signing out clears the private response cache.
To run
the native UI tests on a connected Android device:

```sh
./gradlew connectedDebugAndroidTest
```

When a phone and emulator are both connected, build the test APK and target the
emulator explicitly:

```sh
./gradlew assembleDebug assembleDebugAndroidTest
adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5554 install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s emulator-5554 shell am instrument -w org.trustroots.android.debug.test/androidx.test.runner.AndroidJUnitRunner
```
