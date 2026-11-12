# Link profile hashtags to circles

## Why

Members mention circles in their profile descriptions. Linking those mentions
lets readers open the corresponding circle directly.

## What Changes

- Link hashtags that match a visible circle's current slug in web profile
  descriptions, using the circle's canonical URL.
- Preserve the description's formatting and existing policy for embedded links.

## Impact

The users module uses the existing circle directory API. Saved descriptions and
API contracts require no migration.
