# Improve profile actions and admin navigation

## Why

Profile action links have inconsistent alignment, and administrators need a
direct route from a public profile to its admin record plus username URLs.

## What Changes

- Align profile actions with consistent spacing and icon placement.
- Show an Admin action only to administrators, targeting the viewed member's ID.
- Support `/admin/user/:username` through the existing authorised admin lookup.

## Impact

Profile UI and React route ownership change. Existing ID and query links remain
supported. Admin permissions remain unchanged; no migration or API changes.
