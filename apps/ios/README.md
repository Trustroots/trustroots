# Trustroots iOS

The Trustroots iOS application is a native SwiftUI member client. Its primary
experience is native Profile, Discover, Messages, and More navigation. A
bounded `WKWebView` fallback opens selected Trustroots website routes that are
not yet implemented natively.

The project uses the existing `org.trustroots.trustrootsApp` bundle identifier.
Configure the Apple Developer Team and signing before a TestFlight release.
Simulator builds and continuous integration do not require signing.

## Generate and build

```sh
ruby scripts/generate_xcodeproj.rb
xcodebuild -project Trustroots.xcodeproj -scheme Trustroots -sdk iphonesimulator build
xcodebuild -project Trustroots.xcodeproj -scheme TrustrootsTests -sdk iphonesimulator test
```

The app uses `/api/mobile/v0` with rotating bearer credentials stored in
Keychain. It retains native member search, profiles, hosting details, safety
actions and configured avatars. Its bounded browser has an independent
website session for confirmation and recovery flows.
