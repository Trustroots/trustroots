# Trustroots iOS

The Trustroots iOS application is a native SwiftUI member client. Its primary
experience is native Profile, Discover, Messages, and More navigation. A
bounded `WKWebView` fallback opens selected Trustroots website routes that are
not yet implemented natively.

The checked-in Xcode project has the Trustroots bundle identifier and Apple
Developer Team configured for release. The project generator creates an
unsigned project for simulator development; review signing settings before
using a regenerated project for an App Store build.

## Generate and build

```sh
ruby scripts/generate_xcodeproj.rb
xcodebuild -project Trustroots.xcodeproj -scheme Trustroots -sdk iphonesimulator build
xcodebuild -project Trustroots.xcodeproj -scheme TrustrootsTests -sdk iphonesimulator test
```

The app uses the existing Trustroots JSON routes with a signed website-session
cookie stored in Keychain. The native URL session does not share that
credential with the bounded browser used for confirmation and recovery flows.

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
Cloud workflow. The GitHub Actions iOS workflow only runs unsigned simulator
tests and does not upload an app binary.

Use a matching branch only when a new App Store Connect build is intended.
After an `ITMS-90382` upload-limit failure, pause pushes to matching branches,
wait one day as Apple requests, then trigger one build and check **TestFlight →
Build Uploads** before trying again.
