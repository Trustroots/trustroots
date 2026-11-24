# Share web search filters

## Why

The map and member search use different controls. Search links also lose active filters, and map users cannot see how many results a layer contributes at a glance.

## What changes

- Use consistent, keyboard-accessible switches across web map and member search.
- Display subdued counts for enabled map result types, based on markers in the current viewport.
- Restore search criteria from URL query parameters and update those parameters when criteria change.
- Offer comparable member filters for availability, volunteering, recent activity, circles, languages and connections.

## Impact

Member search applies these criteria on the server before ranking and limiting results, with existing discovery and connection rules.
