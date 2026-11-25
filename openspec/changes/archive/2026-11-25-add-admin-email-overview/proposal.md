## Why

Administrators need one place to check the email queue and investigate delivery interruptions.

## What Changes

- Add an email administration overview with the worker's existing queue health metrics.
- Group SparkPost diagnostics and the reply mailbox under email administration and redirect their old URLs.

## Impact

- Affected specs: admin-moderation, production-email-delivery
- Affected code: admin routes, navigation, and queue diagnostics
