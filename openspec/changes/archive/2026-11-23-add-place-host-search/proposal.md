## Why

Members searching for a city need to compare eligible hosts without opening each map pin. The current Results tab follows the map viewport, which changes with screen size and map movement.

## What Changes

- Open a host list when a member selects a city and use the selected city's bounds.
- Show hosting status, age where available, approximate distance from the city centre, coarse activity and a visible public Experience total.
- Support sorting by name, recent activity and Experience count, and filtering to hosts who can host.
- Preserve results and controls when returning from an offer. Keep viewport results accessible.

## Capabilities

### Modified Capabilities

- `offers-and-search`: Add city-based host discovery to Search.

## Impact

Web search and the offers API gain city list support using existing offer eligibility and Experience author visibility rules. The city list uses the existing six- and 24-month activity cutoffs and shows the public Experience total.
