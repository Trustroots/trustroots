## Why

Staff reviewing the latest acquisition stories need to find members without scanning the whole table. Administrators also need to see the account email alongside each story.

## What Changes

- Show the stored account email in the acquisition-stories table for administrators.
- Add a live, case-insensitive text filter for usernames, names, locations and acquisition-story text. Administrators can also search by account email.
- Apply search to the latest 500 stories alongside the existing filters and sorting.

## Impact

- Affects the acquisition-stories API and React view.
- Email access follows the existing administrator role. Welcome and support team members can search the other fields.
