## Why

`modules/core` imports almost every feature because the client route table lives there. A change in one feature then counts as a change to `core`, and `core` is on the import cycle that reaches the other modules.

## What Changes

- Move the client route table to `layers/shell/client/routes.tsx`.
- Leave a re-export at `modules/core/client/react-app/routes.tsx` so existing imports keep working.
- Keep route behaviour, URLs and page components where they are.

## Impact

The module-graph baseline loses the links that existed only because `core` imported feature pages. `core` still imports `users`, `messages` and `tribes` from the header. No user-facing behaviour change, no data migration, and no deploy change.
