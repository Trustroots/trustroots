# Notify Android preview members about APK updates

## Why

Members who download the signed preview APK directly from GitHub have no update
manager watching for new releases. They may remain on an old build without
realising that a newer preview is available. Obtainium already supports update
alerts for members who choose it, while F-Droid will manage its own builds.

## What Changes

- Offer an opt-in update check in the native Android app for GitHub preview
  builds. Check periodically while opted in and allow an immediate manual check.
- Notify once for each newer signed GitHub preview APK and link to its GitHub
  release page. The app does not download or install an APK itself.
- Enable the feature only in APKs built by the GitHub preview release workflow.
  F-Droid and local builds do not advertise a GitHub APK that may have a
  different signing certificate.
- Document Obtainium as the simpler update-alert route for members who use an
  external update manager.

## Impact

Affected code is the Android app, preview release workflow and Android
distribution documentation. The app stores only the local opt-in preference and
last notified version code. There is no server or database migration. Existing
APKs keep working; the first preview release containing this feature can start
checking after its member opts in. Rollback is a previous APK build.
