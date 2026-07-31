# Add admin scammer-recipient messaging

## Why

When a member sends scam or spam messages, administrators need a quick way to
warn everyone who received them. Reading each conversation and composing a
separate reply is slow and risks missing recipients.

## What changes

- Add an administrator-only API to resolve the distinct members contacted by a
  username.
- Add an administrator-only API to send one warning message to those members,
  creating or updating each conversation thread.
- Add a bulk warning form to `/admin/messages` that previews recipients before
  sending and reports how many messages were delivered.

## Safety

The server resolves recipients from stored messages at send time, filters out
missing members and the administrator, and keeps both endpoints behind the
existing administrator policy and audit log.
