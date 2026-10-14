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

### Requirement: Native Android message alerts

The Android app SHALL let signed-in members opt in to unread-message alerts
through an installed UnifiedPush distributor. It SHALL request notification
permission when required, register only the current account's device, and
remove that registration on opt-out or sign-out. Tapping an alert SHALL open
the relevant conversation. The app SHALL remain usable without a distributor.

#### Scenario: Member enables alerts

- **WHEN** a signed-in member enables message alerts
- **THEN** the app requests notification permission when required
- **AND** helps the member select an installed distributor
- **AND** registers its endpoint for that member

#### Scenario: Member changes account on one device

- **WHEN** a member signs out and another member signs in on the same device
- **THEN** the previous member's registration is removed
- **AND** the new member is not registered until they opt in

#### Scenario: Member taps an unread-message alert

- **WHEN** a member taps an Android unread-message alert
- **THEN** the app opens the matching conversation after checking their session

#### Scenario: No distributor is installed

- **WHEN** the member has no UnifiedPush distributor on their device
- **THEN** native messaging remains usable and no background alert is promised

### Requirement: Opt-in native usage analytics

The Android app SHALL default to sending no native analytics, including in F-Droid builds. It SHALL offer equally accessible enable and disable controls on sign-in and Account, explain the data and destination, and persist consent locally across restarts. Consent SHALL be independent of the signed-in account.

#### Scenario: Fresh installation

- **WHEN** the app opens or navigates before consent
- **THEN** no native analytics requests are sent

#### Scenario: Member opts in

- **WHEN** the member enables usage analytics
- **THEN** subsequent foreground app opens and native top-level screen views are sent to the self-hosted Trustroots Umami endpoint
- **AND** native traffic uses `android.trustroots.org`, fixed `/android/` paths and the Android Umami website identifier `95c86802-44fe-4bff-ab54-dbe9dff27e42`
- **AND** requests contain no credentials, cookies, member data, message data, user-entered values, browser URLs or persistent identifiers

#### Scenario: Member opts out

- **WHEN** the member disables usage analytics
- **THEN** pending requests are cancelled and subsequent events are discarded
- **AND** the choice remains disabled after restarting

#### Scenario: Analytics service is unavailable

- **WHEN** delivery fails or times out
- **THEN** app navigation and authentication continue normally
- **AND** events are not persisted, retried or redirected to another host

### Requirement: Native member navigation and rotation continuity

The Android app SHALL provide labelled bottom navigation with a selected state
and unread-message indicator. Rotation SHALL preserve the active screen, nested
navigation, search/map state and unsaved form values without replaying startup.

#### Scenario: Member rotates while editing

- **WHEN** a member rotates the device while editing a profile
- **THEN** the editor and entered values remain visible without a startup screen

### Requirement: Discoverable native search and profiles

The app SHALL keep place search visible above the map, provide a search-mode
menu and toggle filters independently. Place suggestions SHALL be optional
and result statistics SHALL identify the visible map area. Host cards SHALL
open profiles and show available avatars, usernames and shared circles.
Member search SHALL show a centred empty state with search guidance
and an action to switch to map search. Both search modes SHALL use a compact
search toolbar with the mode menu inside the field. Profiles SHALL default to
About with Contacts and Experiences available through native tabs and swipe
navigation. Hosting details SHALL remain in About.

#### Scenario: Member searches and inspects a host

- **WHEN** a member searches a place and selects a host
- **THEN** a compact host card shows hosting status and available member context
- **AND** opening the card displays About before experiences

### Requirement: Clear native interaction and messaging

Circle discovery SHALL explain membership and visually distinguish joined
circles. Conversations SHALL distinguish senders with message bubbles and
separate the composer, providing an accessible send action beside the input.

#### Scenario: Member sends a message

- **WHEN** a member sends a non-empty draft
- **THEN** it appears in an outgoing bubble and the composer clears on success

### Requirement: Protect unsaved native form changes

Editable forms SHALL expose save and cancel actions and confirm before
discarding edited values through cancel, system back or primary navigation.
Saving SHALL keep the form open on failure and SHALL not allow navigation
to interrupt an in-flight save.

#### Scenario: Member cancels an edited form

- **WHEN** a member cancels or navigates away after changing form values
- **THEN** the app offers to keep editing or discard the changes
- **AND** keeping edits leaves all entered values intact
