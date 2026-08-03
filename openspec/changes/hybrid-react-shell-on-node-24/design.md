## Context

PR work already upgraded the runtime to Node.js 24 and Webpack 5. A separate
`admin-react` branch introduced a React shell with route ownership for public
pages and administration. Those branches are being combined so migration can
continue on the supported runtime.

## Goals / Non-Goals

**Goals**

- Dual client bundles with shared Less styles during the hybrid period.
- Explicit path ownership (`REACT_ROUTE_POLICIES`) driving server render choice
  and client hand-off from Angular links.
- Finish Angular removal, then Bootstrap 5, then Expo removal / Firebase client
  upgrade, in that order.
- Run the completed client on React 18's `createRoot` API and TanStack Router.

**Non-Goals**

- Database driver or ORM majors (`mongoose`, `mongodb`, `bson`, `acl`, `agenda`).
- Redis client majors.
- Rewriting the visual design system beyond Bootstrap 5 compatibility.

## Decisions

1. **Hybrid first:** Keep Angular `main` and React `react-main` entries until
   Stage 2 cutover completes, then delete the Angular entry and packages.
2. **Bootstrap after Angular:** Global Bootstrap 5 only after
   `angular-ui-bootstrap` and Angular templates are gone, avoiding a dual-widget
   CSS break.
3. **Push cleanup last among product stages:** Expo is unused legacy; Firebase
   client FCM is optional and config-gated. Upgrade or remove without blocking
   shell work.
4. **Worktree-safe ESLint:** `root: true` in `.eslintrc.js` so nested git
   worktrees do not load the parent repo ESLint config.
5. **Preserve single-page navigation:** Once every application route is
   React-owned, TanStack Router owns route matching, parameters, search state,
   browser history, route rendering, and not-found handling. A transitional
   document click bridge passes existing plain anchors to the router while
   preserving native browser handling for external, downloaded, targeted,
   modifier-assisted, and fragment links.
6. **Upgrade React with the router:** React moves from 17 to 18 and the browser
   entry uses `createRoot`. Dependencies whose peer ranges exclude React 18 are
   upgraded or replaced rather than installed with peer-dependency overrides.

## Risks / Trade-offs

- Dual bundles increase production asset weight until Angular is removed.
- Bootstrap 5 still needs a broad class/API pass after Angular is gone.
- Incomplete Stage 2 leaves Angular packages in the tree until cutover finishes.

## Migration Plan

1. Stage 1: merge shell onto Node 24, OpenSpec, smoke React-owned routes.
2. Stage 2: migrate remaining Angular routes; remove Angular packages.
3. Stage 3: adopt React 18 and TanStack Router.
4. Stage 4: Bootstrap 5 + react-bootstrap 2.
5. Stage 5: remove Expo; upgrade Firebase client.
6. Stage 6: local verification; archive this change when complete.

## Open Questions

None for Stage 1. Later stages may revisit whether any FCM production secret is
still configured before removing client Firebase entirely.
