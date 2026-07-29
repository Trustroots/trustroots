# Trustroots iOS

The Trustroots iOS application is a native SwiftUI member client. Its primary
experience is native Profile, Discover, Messages, and More navigation. A
bounded `WKWebView` fallback opens selected Trustroots website routes that are
not yet implemented natively.

The project is generated with no signing configuration so it can be built in
continuous integration and on a simulator. Configure the real bundle
identifier, Apple Developer Team, signing, and App Store settings before a
TestFlight release.

## Generate and build

```sh
ruby scripts/generate_xcodeproj.rb
xcodebuild -project Trustroots.xcodeproj -scheme Trustroots -sdk iphonesimulator build
xcodebuild -project Trustroots.xcodeproj -scheme TrustrootsTests -sdk iphonesimulator test
```

The app uses the existing Trustroots JSON routes with a signed website-session
cookie stored in Keychain. The native URL session does not share that
credential with the bounded browser used for confirmation and recovery flows.
