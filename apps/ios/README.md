# Trustroots iOS

The Trustroots iOS application is a native SwiftUI member client. Its primary
experience is native Profile, Discover, Messages, and More navigation. A
bounded `WKWebView` fallback opens selected Trustroots website routes that are
not yet implemented natively.

See the [shared Kotlin and Compose UI assessment](../compose-assessment.md)
for the plan to embed shared Compose journeys within this existing app.

The checked-in Xcode project has the Trustroots bundle identifier and Apple
Developer Team configured for release. The project generator creates an
unsigned project for simulator development; review signing settings before
using a regenerated project for an App Store build.

## Generate and build

```sh
ruby scripts/generate_xcodeproj.rb
xcodebuild -project Trustroots.xcodeproj -scheme Trustroots -sdk iphonesimulator build
xcodebuild -project Trustroots.xcodeproj -scheme TrustrootsTests -sdk iphonesimulator -only-testing:TrustrootsTests test
```

The generated Xcode project builds the shared Compose framework through the
Android Gradle wrapper. Use JDK 17 and Xcode 26.4.1 for the Kotlin 2.4.21
toolchain documented in [the shared Kotlin and Compose UI assessment](../compose-assessment.md).

The app uses `/api/mobile/v0` with rotating bearer credentials stored in
Keychain. The native URL session does not share that
credential with the bounded browser used for confirmation and recovery flows.

## Run the shared Compose pilot journey

Run the fixture in one terminal from `apps/ios`. Use a disposable iOS simulator
for this test. It signs in with a fictional account, expires the access token
before two relaunches, and checks that the pilot can restore and rotate the
Keychain session each time. It also revokes a fresh session, checks that the
pilot returns to sign-in and verifies that it stays signed out after relaunch.

```sh
python3 scripts/shared_member_pilot_server.py --port 18765
```

Run the UI test in another terminal with the UUID of that simulator. Ad-hoc
signing gives the test app an identity for Keychain access.

```sh
xcodebuild -project Trustroots.xcodeproj -scheme TrustrootsTests \
  -destination "id=$SIMULATOR_UDID" -only-testing:TrustrootsUITests \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- test
```

## App Store Connect delivery

The Trustroots App Store Connect record has Apple ID `1470889085` and bundle
identifier `org.trustroots.trustrootsApp`. Xcode Cloud's `Default` workflow
archives the iOS app and prepares it for App Store Connect. Its start condition
is managed in App Store Connect, not in this repository:

1. Open **Trustroots → Xcode Cloud → Manage Workflows → Default**.
2. Set **Start Conditions** to **Branch Changes → Specific Branches → Branches
   beginning with `ios`**. Remove the `main` branch condition and any other
   automatic conditions that would start the archive workflow.
3. Keep the **Archive – iOS** action for App Store Connect delivery.

With these settings, every push to a branch whose name begins with `ios`
starts an archive and upload, while a push to `main` does not start this Xcode
Cloud workflow. The GitHub Actions iOS workflow uses ad-hoc signing for its
simulator tests.

Use a matching branch only when a new App Store Connect build is intended.
After an `ITMS-90382` upload-limit failure, pause pushes to matching branches,
wait one day as Apple requests, then trigger one build and check **TestFlight →
Build Uploads** before trying again.

## Account-scoped Nostr keys

Account → Nostr key keeps one local key per API server and signed-in username
in device-only Keychain storage. Signing out pauses signing and retains that
key for the next sign-in to the same account. Changing accounts or removing a
key clears browser permissions and invalidates pending backup/signing work.
The public npub can be copied; revealing nsec requires device authentication.
The backup disappears when the app becomes inactive or leaves Account.
Set up a device passcode before using backup.

A key from older app versions is initially unclaimed. A live own-profile lookup
adopts it automatically only if the profile's `nostrNpub` matches. Otherwise
Account displays its public key and offers an explicit claim. A durable owner
reservation prevents another account claiming it if migration is interrupted.
Keychain errors remain errors; the app does not store new keys in preferences.
Only legacy Keychain entries are migrated automatically. Old simulator-only
plaintext preference fallbacks are ignored; import a known backup on the
simulator instead.

Account can link the local npub by signing the server's ownership challenge.
Replacing or unlinking the profile key requires confirmation. The profile link
and the local key can be removed independently. Android browser signing,
NIP-46 pairing and push alerts remain follow-up work in
[#3633](https://github.com/Trustroots/trustroots/issues/3633).
The secret-free scope and session revision rules live in `apps/shared`; Keychain,
device authentication and WebKit remain native adapters, following
[#3232](https://github.com/Trustroots/trustroots/issues/3232).

`TrustrootsTests` covers scope isolation, interrupted adoption, invalid imports,
backup authentication and stale operations. The simulator UI journey covers
local generation, sign-out/sign-in retention, removal confirmation and the
separate profile key. On physical iOS hardware, verify passcode/Face ID backup,
background hiding, restore and a signed Radio action before releasing this
feature. Simulator test coverage does not establish that device acceptance.
