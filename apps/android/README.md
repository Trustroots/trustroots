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

## Usage analytics

Usage analytics is off by default in every build, including F-Droid. Enable or
disable it on the sign-in screen or under Account. The choice is stored on the
device and is independent of the signed-in account.

When enabled, the app sends foreground app-open counts and fixed native
top-level screen views to `https://1p.trustroots.org/api/send`, using the existing
Android Umami website identifier `95c86802-44fe-4bff-ab54-dbe9dff27e42`. Filter by
`android.trustroots.org` or `/android/` paths to separate Android usage from
website traffic. Opens are
custom `app-open` events; screen views are pageviews. Profile names, conversation
details, search inputs, map coordinates and browser URLs are never sent. These
counts cover participating installations only.

Requests carry no account credentials, cookies or persistent device identifiers.
The service receives the connecting IP address. Delivery runs independently of
the member API, times out after three seconds, and does not retry, follow
redirects or save events for later delivery. Disabling analytics cancels pending
requests and discards subsequent events. Embedded website pages retain their
own website analytics behaviour; this setting controls native analytics only.

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

## Android preview distribution

The [Android distribution guide](../../distribution/android/README.md) covers
channel status, signing credentials and the release checklist. The signed
GitHub preview APKs are also available through the
[Obtainium import link](../../README.md#android-preview).

See the [Zapstore publishing guide](../../distribution/android/zapstore.md) for
first publication, certificate linking and automated updates, and the
[F-Droid submission instructions](../../distribution/fdroid/README.md) for the
validated source-build recipe, submitted merge request and remaining maintainer
CI and review steps.

### Google Play requirements

See [Google Play release preparation](../../distribution/android/google-play.md)
for account setup, signing, AAB builds, listing requirements and testing.

## Pull request APKs

For a pull request, add the `build-apk` label to request a downloadable debug
APK. The **Android debug APK** workflow runs unit tests and lint before building,
then links the APK artifact in its job summary and a PR comment for branches in
this repository. Download and extract the artifact
to obtain `app-debug.apk` and its SHA-256 checksum. New commits to a labelled PR
trigger a fresh build. Android changes also build automatically without the label.

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
./gradlew -PtrustrootsApiUrl=http://127.0.0.1:38081 connectedDebugAndroidTest
```

The localhost override lets public API wrappers use the device-test fixtures.
The relay integration tests use MockWebServer to exercise real WebSocket
connections locally; this dependency is only included in JVM tests. The Android
geocoder adapter is tested offline with Robolectric, also confined to JVM tests.
Its runtime is pinned to API 35 so these tests continue to run with JDK 17.

Android changes also run all unit and device tests on an API 36 emulator in the
Android debug APK workflow, publishing combined line and branch coverage tables
in its job summary. The report includes every production package and source file,
including untested files; only generated R and BuildConfig classes are excluded.
JaCoCo applies its standard Kotlin bytecode filters. Coverage instrumentation is
opt-in and does not affect ordinary debug or release builds. To generate the
API 36 report locally, with localhost configured for the offline adapter journeys:

```sh
./gradlew -Pkotlin.incremental=false -PtrustrootsCoverage=true -PtrustrootsApiUrl=http://127.0.0.1:38081 debugCoverageTable
python3 scripts/coverage-ratchet.py app/build/reports/coverage/debug/coverage.xml coverage-baseline.json
python3 -m unittest discover -s scripts
```

Coverage commands disable incremental Kotlin compilation so the report uses one
fully compiled set of production classes.

CI also runs eight selected notification, preview-update, WebView, encrypted-storage and
message-permission compatibility journeys on API 32, using the same already-built APKs, then merges those probes into the report. To reproduce that
combined report, stop the API 36 emulator and connect a dedicated API 32 emulator
after the full run above, then run:

```sh
bash scripts/collect-legacy-coverage.sh
./gradlew -Pkotlin.incremental=false -PtrustrootsCoverage=true -PtrustrootsApiUrl=http://127.0.0.1:38081 debugCoverageTable -x testDebugUnitTest -x connectedDebugAndroidTest -x compileDebugKotlin -x compileDebugJavaWithJavac
python3 scripts/coverage-ratchet.py app/build/reports/coverage/debug/coverage.xml coverage-baseline.json
```

The compatibility pass reuses the compiled classes and APKs because rebuilding
between Android versions can change class identities. The localhost API and
UnifiedPush distributor fixture belong to device tests; the fake distributor is
disabled outside its journey and is absent from the application APK.

The generated table is `app/build/reports/coverage/debug/coverage.md`; the XML
report is beside it, and the HTML report is under `html/index.html`. CI uploads
these reports with the test results. The global line and branch coverage ratios
must not fall below `coverage-baseline.json`; comparisons use exact counters, not
the table's rounded percentages. Per-file figures are informational. The baseline
is measured with all unit and device tests, so do not use a filtered test run to
update it.

Repeat the complete suite before raising the floor. The saved `branchMargin`
allows ten branches when calculating a new branch floor: the initial measurements
varied by six branches between local and CI emulators, and by three between local
runs. The line floor uses the measured ratio without an allowance. The allowance
does not relax checks against the saved floor and cannot lower an existing floor.

When coverage improves, raise the baseline and commit it with the change:

```sh
python3 scripts/coverage-ratchet.py app/build/reports/coverage/debug/coverage.xml coverage-baseline.json --update
```

The update refuses regressions. CI also compares the checked-in floor with the
base commit's baseline, preventing a baseline edit from silently lowering it.

For only the design regression journeys, without collecting full-suite coverage:

```sh
./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=org.trustroots.android.ui.DesignFixesJourneyTest,org.trustroots.android.ui.CirclesJourneyTest,org.trustroots.android.ui.MemberNavigationBarJourneyTest
```

When a phone and emulator are both connected, build the test APK and target the
emulator explicitly:

```sh
./gradlew assembleDebug assembleDebugAndroidTest
adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5554 install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s emulator-5554 shell am instrument -w org.trustroots.android.debug.test/androidx.test.runner.AndroidJUnitRunner
```
