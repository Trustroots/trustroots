## Why

Members use availability, descriptions, and location together when editing a hosting offer. A single page lets them review those settings before saving. Meeting availability has three answers, and an unanswered preference needs no separate choice.

## What Changes

- Place availability, description, and location on one responsive hosting-offer form.
- Open the relevant section from existing fragment links, including links to choose a location.
- Show Yes, Maybe, and No for meeting availability on the profile and in the editor. Leave all choices unselected for members who have yet to answer.

## Capabilities

### Modified Capabilities

- `ongoing-meeting-availability` covers the single-page hosting offer editor and the three available choices.

## Impact

The offers client and its browser tests change. The existing stored unanswered value remains valid and requires no migration.
