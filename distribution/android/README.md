# Android distribution

Publishing instructions for `org.trustroots.android`. For development, local
builds and device tests, see the [Android app README](../../apps/android/README.md).

## Channels

| Channel         | Distribution                                                  | Next step                                                                                                      |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GitHub Releases | Signed preview APKs published by the Android release workflow | Verify each new release and keep the signing key stable                                                        |
| Obtainium       | Tracks the same GitHub prereleases                            | Use the [import link and manual setup instructions](../../README.md#android-preview)                           |
| Zapstore        | Configuration and optional CI publishing step exist           | Complete and verify the [first publication](zapstore.md) before enabling automation                            |
| F-Droid         | Source-build submission draft exists                          | Follow the [F-Droid submission instructions](../fdroid/README.md) for current validation and submission status |
| Google Play     | Current release workflow publishes APKs only                  | Prepare an AAB and [internal testing release](google-play.md)                                                  |

We will not submit this app to IzzyOnDroid under its current
[app inclusion policy](https://izzyondroid.org/docs/general/AppInclusionPolicy/),
including its criteria concerning AI-generated code.

## Configuration locations

- [Android build and signing configuration](../../apps/android/app/build.gradle.kts)
- [Signed preview release workflow](../../.github/workflows/android-preview-release.yml)
- [Zapstore configuration](../../zapstore.yaml), kept at the repository root for publisher verification
- [Zapstore publishing script](publish-zapstore.sh), which finds the root configuration automatically
- [Store listing text and images](../../fastlane/metadata/android/en-US/)
- [F-Droid build metadata](../fdroid/metadata/org.trustroots.android.yml)

Keep configuration in these locations; these guides describe how to use it.

## Signing credentials

The local release keystore is held outside the repository, in the publisher's
home directory. Its exact filename, alias and credentials must come from the
signing-key custodian. Keep a secure backup and reuse the existing key for
updates to installed GitHub APKs.

The preview workflow uses these GitHub Actions secrets:

| Secret                      | Purpose                         |
| --------------------------- | ------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | Base64-encoded release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password               |
| `ANDROID_KEY_ALIAS`         | Signing-key alias               |
| `ANDROID_KEY_PASSWORD`      | Signing-key password            |

During CI, the workflow reconstructs the keystore at
`$RUNNER_TEMP/trustroots-release.jks` and supplies its path through
`ANDROID_KEYSTORE_PATH`. This is a temporary runner path, not a local backup.
Existing GitHub secret values cannot be retrieved from the settings UI.
Keep keystores, passwords, private Nostr keys and signer credentials outside Git.

## Release checklist

1. Choose the channel and source commit. Run the Android tests and lint checks
   documented in the app README before publishing.
2. Use the intended signing certificate and a version code greater than the
   versions already distributed to that channel. Coordinate codes across
   channels that should support updates between them.
3. Check listing text, screenshots, privacy information and release notes.
4. Publish through the channel's guide. The GitHub preview workflow runs for
   relevant changes on `main` or by manual dispatch and assigns its own versions.
5. Verify installation and an update from the previous version on a device;
   check sign-in, host search and messaging.
6. Add or update the public download link on the [apps page](../../docs/apps.md)
   once the listing is verified.

GitHub, Obtainium and Zapstore distribute the project-signed APK. The current
F-Droid draft uses F-Droid's own signing key, so switching to that build requires
reinstallation. Plan Google Play signing before its first upload if updates
between Play and the project-signed APK should be supported.
