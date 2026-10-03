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

## APK update alerts

The signed GitHub preview APK lets members opt in to update alerts from Account
→ APK updates. It checks GitHub Releases daily and links to the release page
when a newer signed Android preview is available. Android 13 and later asks for
notification permission when alerts are enabled. A member can also check
immediately from Account. The app does not download or install updates.

The preview release workflow enables this feature with
`-PtrustrootsPreviewUpdateAlerts=true`. Local and F-Droid builds leave it off:
F-Droid's build may have a different signing key, so linking its members to a
GitHub APK could suggest an update they cannot install. Members using
[Obtainium](https://obtainium.imranr.dev/) can leave the in-app option off and
use Obtainium's GitHub prerelease alerts instead. Keep the signing key stable
and increase Android version codes for every preview update.

## Message alerts without Google services

Signed-in members can opt in under Account → Message alerts. The phone needs an
installed [UnifiedPush distributor](https://unifiedpush.org/users/distributors/),
such as ntfy, and Android notification permission. The app asks the member to
choose a distributor, then registers a Web Push endpoint with Trustroots.
Email reminders continue whether or not message alerts are enabled. An alert
appears after the first unread-message reminder, around ten minutes after the
message was sent, and shows only generic text on the lock screen. It opens the
conversation when tapped. The APK does not use Firebase or Google Play
services for message delivery.

The server requires `TRUSTROOTS_WEB_PUSH_VAPID_PUBLIC_KEY`,
`TRUSTROOTS_WEB_PUSH_VAPID_PRIVATE_KEY`, and
`TRUSTROOTS_WEB_PUSH_VAPID_SUBJECT` (a `mailto:` or HTTPS contact URL).
Generate one VAPID pair with `npx web-push generate-vapid-keys` and keep its
private key in the server's secret configuration. Set
`TRUSTROOTS_WEB_PUSH_ALLOWED_HOSTS` to a comma-separated list of trusted HTTPS
push endpoint hosts. It defaults to `ntfy.sh`; include self-hosted distributor
hosts explicitly. The server rejects other hosts so registered endpoints
cannot be used to contact arbitrary addresses. Without VAPID configuration,
the Account control reports that message alerts are unavailable.

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
