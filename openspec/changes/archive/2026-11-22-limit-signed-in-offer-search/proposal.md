## Why

The browser map and native apps use the same offer search. A shared per-member allowance gives interactive searches room for map movement and filter changes while bounding repeated queries.

## What Changes

- Give signed-in browser and mobile offer searches a common per-member allowance within each API process.
- Return HTTP 429 with retry guidance before running a search when the allowance is exhausted.

## Impact

- Updates the `offers-and-search` spec and the browser and mobile search routes.
- Uses an in-memory counter, as used by other read-heavy routes.
