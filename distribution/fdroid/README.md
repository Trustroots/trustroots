# F-Droid submission draft

The build recipe in `metadata/org.trustroots.android.yml` is a draft for
F-Droid's `fdroiddata` repository. It has not been submitted or accepted.

The first build entry targets the existing `android-preview-8` release. It
records the published version name, version code and full source commit. The
release predates the upstream Fastlane listing files, so replace this entry
with the first release made after those files are merged before submitting.
Use that release's full commit hash, version name and version code in both the
build entry and `CurrentVersion` fields. Future release tags contain both
version fields in the form `android-preview-<code>-v<name>`, which the update
check extracts for automatic build entries.

To test the recipe, copy it to `metadata/org.trustroots.android.yml` in a
checkout of [fdroiddata](https://gitlab.com/fdroid/fdroiddata). Run
`fdroid readmeta`, `fdroid lint org.trustroots.android`,
`fdroid checkupdates --allow-dirty org.trustroots.android`, and
`fdroid build org.trustroots.android`. Resolve any scanner or build failures
before opening a merge request to fdroiddata. The app's listing assets live in
`fastlane/metadata/android/en-US` in this repository.

The draft uses F-Droid's own signing key. An APK installed from GitHub,
Obtainium or Zapstore has a different signing key and cannot be updated in
place with that F-Droid build. F-Droid can use the project's signing key only
after an independently built APK matches the developer-signed APK and the
recipe includes the upstream binary URL and allowed signing certificate.
