# Move profile views to the React shell

## Why

Profile viewing still starts an Angular controller and template even though most
of the displayed sections use React components. Moving the profile shell and
its tabs to the React entry point lets members view profiles without loading
Angular while retaining the established links and access rules.

## What Changes

- Render profile about, overview, accommodation, contacts, circles and
  experience-history pages in the React shell.
- Preserve the profile navigation, contact request actions, privacy, missing
  member display and mobile tab behaviour.
- Keep Angular named-state links into the new view routes. Profile editing and
  experience writing remain in their current workflows.

## Impact

This changes profile route ownership and client rendering only. Existing URLs,
server APIs, permissions, Node 24 runtime and data remain compatible. There is
no data migration or deployment change.
