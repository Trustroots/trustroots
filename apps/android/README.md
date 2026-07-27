# Trustroots for Android

This is the native Kotlin and Jetpack Compose sibling of the Trustroots iOS
member app. It intentionally shares the versioned mobile API contract while
keeping its UI and lifecycle Android-native.

## Open in Android Studio

Open `apps/android`, select a JDK 17 runtime and install Android SDK 37 when
prompted. The debug build uses `https://pr2777.test.trustroots.org` by default.

To use another API server:

```sh
./gradlew installDebug -PtrustrootsApiUrl=https://pr2777.test.trustroots.org
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
sign-in screen shows both its build date and the exact API server in use.
