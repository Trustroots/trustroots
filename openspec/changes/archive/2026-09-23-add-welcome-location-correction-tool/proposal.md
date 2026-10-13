# Add welcome team location correction tool

## Why

Historic offer editors saved the map's default coordinates near Stuttgart when a member had not chosen a location. Members with those offers may still appear in the wrong place. The welcome team needs a careful way to find and contact them without changing their locations on their behalf.

## What Changes

- List current offers at the former default coordinates and in the small area recorded in issue #132, grouped by member and labelled as exact or nearby matches.
- Let welcome team members review a candidate and send one editable Trustroots message from their own account.
- Record contact against the reviewed offer locations, prevent duplicate sends, and remove contacted members from the default queue until a location changes.
- Require an explicit location when creating hosting and meeting offers, while retaining the default map view.

## Impact

Affected areas: offer editors, welcome team administration, messaging, and offer search. Two welcome team authorised endpoints are added for candidate listing and sending. Existing offers and messages need no migration. The tool sends only on an explicit team member action; it never changes offer locations.
