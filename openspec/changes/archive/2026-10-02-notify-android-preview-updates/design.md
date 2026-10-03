# Design

The GitHub release workflow sets a build flag only for its signed release APK.
The Android app keeps update checks disabled until the member opts in from
Account. Enabling queues a unique daily WorkManager request with a network
constraint and runs an immediate check. Disabling cancels that work.

The checker reads the public GitHub Releases API, selects a prerelease with the
expected Android preview tag, build code and APK asset, and compares its build
code to `BuildConfig.VERSION_CODE`. It ignores malformed and unrelated releases.
The notification links to the selected release page on the fixed Trustroots
GitHub repository. A stored last-notified build code prevents repeated alerts.
Network and parsing failures are harmless; a later check can retry.

The update channel has its own Android notification channel. On Android 13 and
later the app asks for notification permission when the member enables alerts.
Permission denial leaves the preference visible and permits a later retry.
The worker checks permission immediately before posting; it does not post when
permission is absent. No release service credential is embedded in the APK.

Obtainium users can leave the in-app option off and let Obtainium notify them.
The feature is absent from local and F-Droid builds, which may use a different
signing certificate. Opening a release page avoids Android package installer
permissions and leaves installation under the member's control.
