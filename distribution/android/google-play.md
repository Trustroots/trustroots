# Google Play release preparation

The current [preview workflow](../../.github/workflows/android-preview-release.yml)
publishes signed APKs to GitHub. It does not build or upload a Play release.
Google Play preparation requires an Android App Bundle (`.aab`) upload path and
Play Console configuration.

## Account and signing

1. Confirm access to the project-owned Play Console account, or complete
   [developer account registration](https://support.google.com/googleplay/android-developer/answer/6112435).
   Confirm account verification and publishing permissions.
2. Use the existing application ID, `org.trustroots.android`.
3. Plan Play App Signing before the first upload. If project-signed APK users
   should be able to update through Play, arrange compatible signing with the
   existing app-signing key. Distinguish that key from the Play upload key and
   coordinate version codes across channels. Follow the official
   [app-signing guidance](https://developer.android.com/studio/publish/app-signing).
4. Because the package is already distributed outside Play, check any applicable
   [package ownership verification](https://developer.android.com/developer-verification/guides/google-play-console)
   requirements in the console.

## Prepare the bundle

Add an AAB build/upload path as a separate implementation task. For an initial
local bundle, from `apps/android`, after configuring signing and version values:

```sh
./gradlew testDebugUnitTest lintRelease bundleRelease -PtrustrootsPreviewUpdateAlerts=false
```

The bundle is written to `app/build/outputs/bundle/release/app-release.aab`.
The build reads `ANDROID_VERSION_CODE`, `ANDROID_VERSION_NAME`,
`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD`; see [signing credentials](README.md#signing-credentials).
Use the chosen Play upload key according to the signing plan. Do not use the
default development version values for a store upload.

Keep the GitHub preview-update control disabled in Play builds so Play members
receive updates through their store. Verify the current
[target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
before uploading; the build's target SDK is declared in the
[Android configuration](../../apps/android/app/build.gradle.kts).

## Listing and review

Start with the [existing listing assets](../../fastlane/metadata/android/en-US/),
then complete Play Console's listing and app-content sections: screenshots and
graphics, contact information, privacy policy, Data safety, ads declaration,
content rating, target audience and reviewer access to signed-in features.
Check the app's account-deletion and reporting/blocking flows against current
Play requirements. Supply a dedicated reviewer account through Play Console;
keep its credentials outside the repository.

Use Google's [review preparation guide](https://support.google.com/googleplay/android-developer/answer/9859455)
to check the current declarations required for this app.

## Testing and production

1. Upload the signed AAB to internal testing and review the pre-launch report.
2. Test installation, updates, sign-in, host search, profile editing, messaging
   and notification setup on physical devices.
3. Complete any required closed testing and resolve feedback. For personal
   accounts created after 13 November 2023, Google currently requires at least
   12 testers opted in continuously for 14 days before applying for production
   access. See the [testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).
4. Submit the release for review and choose an initial production rollout after
   testing and account requirements are satisfied.
5. Verify the public listing and add its URL to the [apps page](../../docs/apps.md).

Store rules change; consult the linked official guidance and the account's
console before each submission. These instructions do not indicate that a Play
release has already been uploaded or approved.
