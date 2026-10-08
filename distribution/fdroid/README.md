# F-Droid submission draft

The build recipe in `metadata/org.trustroots.android.yml` is a draft for
F-Droid's [fdroiddata repository](https://gitlab.com/fdroid/fdroiddata). It has
not been submitted or accepted.

The first build targets the published `android-preview-100014-v0.1-20261005-2310`
release: version name `0.1-20261005-2310`, version code `100014`, source commit
`b533eed0080412cc1cd42015b426faa41a4fe0ed`. Unlike the old preview-8 entry, this
release includes the Fastlane listing assets in `fastlane/metadata/android/en-US`.
The remote tag and listing files were checked on 2026-10-08.

Future release tags contain both version fields in the form
`android-preview-<code>-v<name>`, which `UpdateCheckData` extracts for automatic
build entries. The build passes both fields to the existing Gradle environment
variables. Preview APK update alerts are disabled by default, so F-Droid users
receive updates through their F-Droid client.

## Validation

On 2026-10-08, `fdroid readmeta` and `fdroid lint org.trustroots.android` passed
using fdroidserver 2.4.5 and the official fdroiddata category configuration.
`fdroid checkupdates --allow-dirty org.trustroots.android` also passed against
the remote release tags and confirmed version code `100014` is current.
The source scanner also passed in F-Droid's official Linux build container,
without scanner exclusions. It reported warnings for web fonts and server test
fixtures outside the Android app; it found no scanner errors.

The container used was
`registry.gitlab.com/fdroid/fdroidserver:buildserver`, digest
`sha256:9cb68105642ca4e7b295f0ceab10f069f5b3247dc18fa7c36046e9d81aa469a8`,
with fdroidserver source commit `c21c177ff6d813697aaf9c988ca9fbb2b571b468`.
Its Gradle launcher selected the project's Gradle 9.4.1 wrapper version.

`fdroid build --no-refresh org.trustroots.android` completed successfully in
that container using a local clone containing the published tags. F-Droid
verified the APK against the expected package and version fields. An
independent `aapt2 dump badging` check confirmed package
`org.trustroots.android`, version code `100014`, version name
`0.1-20261005-2310`, and target SDK `37`. The resulting APK is unsigned, ready
for F-Droid signing.

The build emitted upstream API deprecation warnings and a warning that
`libandroidx.graphics.path.so` was packaged without stripping. These did not
prevent a successful build. The remaining step is to submit the recipe to
fdroiddata for review; successful local validation does not mean acceptance.

## Reproduce and submit

Follow F-Droid's [submission guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
to clone fdroiddata and fdroidserver and launch the official build container.
Copy this recipe to `metadata/org.trustroots.android.yml` in fdroiddata, then
run these commands from the fdroiddata directory in the container:

```sh
fdroid readmeta
fdroid lint org.trustroots.android
fdroid checkupdates --allow-dirty org.trustroots.android
fdroid build org.trustroots.android
```

Resolve any scanner, dependency, SDK, APK version or build failures before
opening a merge request to fdroiddata. After a successful build, commit the
recipe on a branch in a GitLab fork of fdroiddata and open a merge request
with the title `New App: org.trustroots.android`. Include the upstream release
tag and commit, validation results, and the signing arrangement below. A
GitLab account with permission to push to the fork is required; none was
configured in the validation environment.

## Signing

This draft uses F-Droid's own signing key. An APK installed from GitHub,
Obtainium or Zapstore has a different signing key and cannot be updated in
place with that F-Droid build. F-Droid can use the project's signing key only
after an independently built APK matches the developer-signed APK and the
recipe includes the upstream binary URL and allowed signing certificate.

The current release embeds its build time and enables preview update alerts
in the GitHub build, so an F-Droid build using this recipe is not expected to
match that APK. Reproducible upstream signing needs a separate build change
and a new release; it is not a prerequisite for the F-Droid-signing route.
