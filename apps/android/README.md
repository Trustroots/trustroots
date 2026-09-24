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
