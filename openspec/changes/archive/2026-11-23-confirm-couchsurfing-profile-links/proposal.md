# Update profile network links

## Why

Members should be able to visit other network profiles without leaving their Trustroots page, and see a warning before opening Couchsurfing.

## What changes

- Open outbound links in the profile’s Elsewhere section in a new tab.
- Show full network names when hovering over the profile entries on desktop.
- Restore the Couchsurfing profile destination and its editor Test action behind a shared confirmation for members who have saved their own Couchsurfing handle.
- Add Hitchwiki and Hitchwiki Maps as optional editable profile networks.

## Impact

- Affected specifications are `site-presentation` and `member-profiles`.
- Affected code is the web profile, profile networks editor and profile API. Members can add or clear either Hitchwiki username without migrating existing profiles.
