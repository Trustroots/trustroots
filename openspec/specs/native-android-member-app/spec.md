# native-android-member-app Specification

## Purpose
TBD - created by archiving change notify-android-preview-updates. Update Purpose after archive.
## Requirements
### Requirement: Android preview APK update alerts

The GitHub preview Android APK SHALL let a member opt in to periodic update
checks. When a newer signed Android preview release is available, the app SHALL
notify the member at most once per version and open the corresponding Trustroots
GitHub release page on request. The app SHALL NOT install an APK automatically.
Local and F-Droid builds SHALL NOT offer GitHub preview update alerts.

#### Scenario: Member enables update alerts

- **WHEN** a member enables APK update alerts in a GitHub preview build
- **THEN** the app requests notification permission when required
- **AND** schedules periodic release checks

#### Scenario: Newer Android preview is found

- **WHEN** an opted-in preview build finds a newer Android preview release with
  a matching APK asset
- **THEN** the app posts one update notification for that version when permitted
- **AND** tapping the notification opens that release page

#### Scenario: Unrelated or incompatible release is found

- **WHEN** the release feed contains a non-Android release, a malformed Android
  preview release, or a release no newer than the installed version
- **THEN** the app does not post an update notification for it

#### Scenario: Member disables update alerts

- **WHEN** a member disables APK update alerts
- **THEN** the app cancels periodic checks and posts no further update alerts
