## Why

Circle maps need clearer ride details, consistent Trustroots styling and a viewport that stays filled with tiles. The Hitchhikers circle should show only rides submitted through Hitchwiki Maps.

## What Changes

- Restrict ride sources to maps.hitchwiki.org and show available waiting time, distance, signal, submission date and reasons in compact popups.
- Shorten the map introduction and combine the seven-day count and source credits.
- Enable pinch and wheel zoom on both circle maps, constrain the world viewport and improve shared links and circle actions.
- Exclude closed hackerspaces from the map and active imports, retiring previously published closed spaces through the existing approval workflow.
- Place Hackers wiki resources and members beside each other on desktop, with a compact, fading hero and the Circle Wiki action beside the resources.

## Impact

Affected: tribes client components, ride parsing, administrator import services, tests and circle specifications. No data migration is required. Existing other-source rides and closed spaces are intentionally excluded. Existing closed Nostr records are hidden immediately by the map and can be retired on the next administrator-approved refresh.
