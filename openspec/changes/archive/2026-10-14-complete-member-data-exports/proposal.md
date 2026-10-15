# Complete member data exports

## Why

The existing download contains only part of the records a member has created. A dated filename also makes repeated downloads easier to identify.

## What Changes

- Include circle memberships, all stored hosting and meet offers, authored messages and authored experiences alongside the existing sanitised profile and contacts.
- Name downloads with the member's safe username and UTC export time, falling back to the timestamp alone for unsafe usernames.
- Describe the included and excluded data in account settings.
- Keep the authenticated endpoint, unsigned format and version 1 envelope, with additive sections and the existing `hostingOffers` field.

## Impact

- Affected specification: account-access.
- Affected code: member export controller, account settings and export regression tests.
- Queries select records owned or authored by the authenticated member; received messages, other members' authored experiences, credentials and profile photo files remain outside the download.
