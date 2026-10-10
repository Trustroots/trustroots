# F-Droid submission

The build recipe in `metadata/org.trustroots.android.yml` is a draft for
F-Droid's [fdroiddata repository](https://gitlab.com/fdroid/fdroiddata). It was
submitted on 2026-10-08 in [merge request !51684](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/51684)
and is awaiting review and acceptance.

The recipe targets the published `android-preview-100015-v0.1-20261008-0919`
release: version name `0.1-20261008-0919`, version code `100015`, source commit
`52839d4d3aa5a0e8c972f4101dd17371e6b31c0e`. The release and tag were verified
on 2026-10-10. Only this latest build is retained, with category `Social Network`.

The app is AGPL-3.0-only. Using the hosted Trustroots service is subject to its
service terms and community rules; these are separate from the software licence.
The server source is in this same repository and can be self-hosted. The
published Android app connects to `www.trustroots.org`; a custom build can target
another server. Broader forkability is tracked in
[issue #2669](https://github.com/Trustroots/trustroots/issues/2669).

Native opt-in Umami analytics added after this release is not in the pinned
100015 build. A future submission update must disclose it and rerun the network
review both before consent and after enabling and disabling analytics.

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
prevent a successful build.

The [branch pipeline](https://gitlab.com/guaka/fdroiddata/-/pipelines/2925672801)
failed immediately with no jobs and no YAML errors. The
[merge-request pipeline](https://gitlab.com/guaka/fdroiddata/-/pipelines/2925678703)
also failed before starting. The merge request asks F-Droid maintainers to run
CI on their runners. Review and successful upstream CI remain outstanding;
local validation does not mean acceptance.

## Reproduce the validation

From the Trustroots repository root, prepare fresh checkouts and launch the
same pinned Linux image and server revision used for validation:

```sh
git clone --depth 1 https://gitlab.com/fdroid/fdroiddata.git fdroiddata
git clone https://gitlab.com/fdroid/fdroidserver.git fdroidserver
git -C fdroidserver checkout c21c177ff6d813697aaf9c988ca9fbb2b571b468
cp distribution/fdroid/metadata/org.trustroots.android.yml fdroiddata/metadata/
docker run --rm -it --platform linux/amd64 --user vagrant \
  --entrypoint /bin/bash \
  -v "$PWD/fdroiddata:/build" \
  -v "$PWD/fdroidserver:/home/vagrant/fdroidserver" \
  registry.gitlab.com/fdroid/fdroidserver:buildserver@sha256:9cb68105642ca4e7b295f0ceab10f069f5b3247dc18fa7c36046e9d81aa469a8
```

Inside the container:

```sh
source /etc/profile
export PATH="$fdroidserver:$PATH" PYTHONPATH="$fdroidserver"
cd /build
fdroid readmeta
fdroid lint org.trustroots.android
fdroid checkupdates --allow-dirty org.trustroots.android
fdroid build org.trustroots.android
```

The recorded build used `--no-refresh` after preparing a local clone with the
published tags. Omit that option for a fresh clone so F-Droid fetches upstream.
The first build downloads Gradle, SDK components and dependencies; an amd64
container on an ARM host also runs under emulation.

For general packaging instructions, see F-Droid's
[submission guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/).

## Next steps

1. **Maintainer CI:** the submission already requests a run on F-Droid's
   runners because the fork pipelines did not start jobs. Check the
   [merge request's pipelines](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/51684/pipelines)
   and reports. If GitLab asks for phone or card verification, F-Droid's
   [app-inclusion template](https://gitlab.com/fdroid/fdroiddata/-/blob/master/.gitlab/merge_request_templates/App%20inclusion.md)
   says to leave a note requesting their CI instead of supplying those details.
2. **Respond to review:** resolve recipe or scanner findings on the existing
   `codex/trustroots-android` branch in the public
   [guaka/fdroiddata fork](https://gitlab.com/guaka/fdroiddata). Keep the build
   pinned to the full commit hash, retain only the latest release before
   acceptance, rerun affected validation, and update this repository's recipe
   to match. Do not open a duplicate submission while !51684 is open.
3. **After acceptance:** wait for F-Droid's first build and repository index.
   Verify the `org.trustroots.android` listing, signing certificate, installation
   and normal member journeys before adding a download link to
   [the apps page](../../docs/apps.md). Merge of the recipe alone does not mean
   the APK is available to install.
4. **Future releases:** continue publishing tags in the existing
   `android-preview-<code>-v<name>` format with increasing version codes and
   upstream Fastlane metadata. F-Droid's update checker can then generate the
   next build entry; monitor its build and publication results. F-Droid-signed
   installations continue receiving F-Droid-signed updates.

## Signing

This recipe requests F-Droid's own signing key. An APK installed from GitHub,
Obtainium or Zapstore has a different signing key and cannot be updated in
place with that F-Droid build. F-Droid can use the project's signing key only
after an independently built APK matches the developer-signed APK and the
recipe includes the upstream binary URL and allowed signing certificate.

The current release embeds its build time and enables preview update alerts
in the GitHub build, so an F-Droid build using this recipe is not expected to
match that APK. Reproducible upstream signing needs a separate build change
and a new release; it is not a prerequisite for the F-Droid-signing route.
