## Implementation

- [x] Move the client route table to `layers/shell/client/routes.tsx`.
- [x] Re-export it from the previous core path.
- [x] Point the internal-link check, TypeScript project and client coverage at the shell file.
- [x] Update `module-graph-baseline.json` so the removed links are locked in.

## Verification

- [x] Client route tests and the internal-link check pass.
- [x] The module-graph check passes with a smaller `core` import list.
