# F-Droid submission

The build recipe in `metadata/org.trustroots.android.yml` is a draft for
F-Droid's [fdroiddata repository](https://gitlab.com/fdroid/fdroiddata). It was
submitted on 2026-10-08 in [merge request !51684](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/51684)
and is awaiting review and acceptance.

The recipe targets the published [Android preview 100066](https://github.com/Trustroots/trustroots/releases/tag/android-preview-100066-v0.1-20261110-1020)
with version name `0.1-20261110-1020` and source commit
`1b74047d745751d0476c090438e277578419a7f8`. It matches the recipe submitted in
!51684 at revision `7b4c239f425475b1c22a2856df4a1eb5b7ab9af9`.

The app is AGPL-3.0-only. Using the hosted Trustroots service is subject to its
service terms and community rules; these are separate from the software licence.
The server source is in this same repository and can be self-hosted. The
published Android app connects to `www.trustroots.org`; a custom build can target
another server. Broader forkability is tracked in
[issue #2669](https://github.com/Trustroots/trustroots/issues/2669).

Future release tags contain both version fields in the form
`android-preview-<code>-v<name>`, which `UpdateCheckData` extracts for automatic
build entries. The recipe sets both fields in the Gradle app configuration.
The release derives its build timestamp from the pinned commit. Preview APK
update alerts are disabled by default, so F-Droid users receive updates through
their F-Droid client.

## Validation

The [October maintainer pipeline](https://gitlab.com/fdroid/fdroiddata/-/pipelines/2936123987)
passed on an earlier recipe. The [fork pipeline for build 100066](https://gitlab.com/guaka/fdroiddata/-/pipelines/3049163391)
failed before creating any jobs. The APK URL and signing certificate in the
current recipe match the published release metadata. Independent
reproducibility verification for this recipe is pending.

## Reproduce the validation

From the Trustroots repository root, prepare fresh checkouts and launch the
pinned Linux image and server revision from the earlier build:

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
fdroid build --test org.trustroots.android:100066
```

The build downloads the reference APK specified by `Binaries`, compares
the locally built APK against it and checks the upstream signing certificate
against `AllowedAPKSigningKeys`. The first build downloads Gradle, SDK
components and dependencies. An amd64 container on an ARM host runs under
emulation.

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
   next build entry. Monitor its build and publication results.

## Signing

The recipe specifies the upstream APK and its allowed signing certificate.
After a successful reproducible build, F-Droid can distribute the verified
upstream-signed APK. Android can update an existing installation in place when
the package and signing certificate match and the update has a higher version
code.
