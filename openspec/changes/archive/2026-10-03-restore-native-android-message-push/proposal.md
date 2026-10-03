# Restore Google-free Android unread-message alerts

## Why

The native Android APK has conversations but no background message alerts.
Browser and legacy mobile push was retired, and the server now rejects all new
registrations. Members receive unread-message email reminders, but cannot opt
in to a private Android notification when a conversation remains unread.

## What Changes

- Add UnifiedPush registration for signed-in Android members. It uses an
  installed push distributor such as ntfy and does not depend on Google Play
  services or Firebase. Legacy Expo and browser registrations stay retired.
- Send one encrypted, generic Android alert when the existing first
  unread-message reminder is due. Reuse its grouping and moderation checks;
  keep email delivery unchanged.
- Let Android members enable or disable message alerts, select a distributor,
  grant notification permission, and open the relevant conversation from an
  alert.
- Configure Web Push VAPID keys and an allowlist of trusted push endpoint
  hosts on the server. The feature remains unavailable where they are absent.

## Impact

Affected modules are the native Android app, member registration API, unread
message worker and configuration. Historical push registration records remain
valid and removable, but are not selected for delivery. No data migration is
required. Members without a push distributor continue to receive email
reminders and can use native messaging normally.
