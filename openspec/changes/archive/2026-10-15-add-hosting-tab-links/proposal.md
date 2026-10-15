## Why

Members cannot link directly to the hosting location editor, and profile
accommodation panels omit the offer's approximate location map.

## What Changes

- Give Availability, Description and Location stable URL fragments, with direct
  links and browser Back/Forward support.
- Keep Location accessible before the description is complete; saving still
  requires valid offer details.
- Show a compact map for active hosting offers on visible profiles using the
  existing offer map and the location supplied by the offers API.
- Label the approximate location and give owners a direct location-edit link.
- Add a clear editor heading, keep mobile controls in the page flow, and make
  the editor map fill its frame.

## Capabilities

### Modified Capabilities

- `offers-and-search`: Hosting editor tab links and compact profile maps.

## Impact

Only offer client components, styles, translations and tests change. Existing visibility rules and
public location randomisation apply. No API, migration or deployment changes.
