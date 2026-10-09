# List visible map results

## Why

Opening the Results pane without selecting a pin currently shows an instruction to choose something from the map. Members cannot scan the hosts, offers, and community Nostr notes already visible in their current map area.

## What changes

- Show a list of available offers whose pins fall within the current map viewport when the Results pane is open.
- Show member profile details and offer status, and let selecting a list item open the existing offer details in the sidebar.
- Include visible community Nostr note threads when their map layer is enabled, using the same author visibility rules as the map, and open the existing thread view when selected.
- Return from selected offer or note details to the current Results list.
- Keep map pin selection working and preserve the map viewport when an offer is opened.

## Impact

This changes the search map sidebar behaviour and uses the existing offer detail endpoint for list entries. No data migration or server API change is expected.
