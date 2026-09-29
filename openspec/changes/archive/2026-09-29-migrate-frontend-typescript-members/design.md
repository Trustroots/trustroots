## Context

The five assigned client modules contain 90 JavaScript production files, including React components, API wrappers, utilities and constants. TypeScript is already enabled for client `.ts` and `.tsx` files, while test coverage and translation extraction include TypeScript. Existing callers and tests use JavaScript module paths, and the migration must preserve those integration points.

## Goals / Non-Goals

**Goals:**
- Bring every production client module in the assigned scope under strict TypeScript checking.
- Preserve current rendering, API calls, translations, exports and user interactions.
- Retain all existing client tests and coverage thresholds.

**Non-Goals:**
- Change application behaviour, APIs, data models, dependencies, or module ownership.
- Convert the JavaScript client tests as part of this batch.
- Change files owned by other migration batches or alter shared tooling without coordination.

## Decisions

- Convert React components to `.tsx` and non-JSX modules to `.ts`, using local domain types and typed boundaries for existing JavaScript dependencies. This gives useful checking while keeping changes scoped to the assigned modules.
- Preserve existing import paths and rely on coordinated shared resolver support for explicit `.js` references. This avoids duplicate compatibility shims and keeps sibling batches independently mergeable.
- Keep tests in JavaScript and run the existing suite against the converted sources. This focuses the change on production types and uses the current behaviour assertions as regression coverage.
- Preserve translation keys and extraction markers verbatim so the existing extraction pipeline continues to discover them.

## Risks / Trade-offs

- [Weakly typed legacy boundaries can obscure incorrect assumptions] → Add narrow structural types at module boundaries and validate the migrated sources with TypeScript and existing tests.
- [Explicit `.js` imports may not resolve to TypeScript by default] → Coordinate a shared webpack and Jest resolver adjustment with the parent migration coordinator.
- [Test coverage may drop if converted files are not collected] → Run scoped client coverage and confirm thresholds remain unchanged.

## Migration Plan

1. Convert the assigned production modules, retaining exports and import compatibility.
2. Run TypeScript, scoped lint, client tests and coverage, plus the production webpack build where the environment permits.
3. Archive the change and merge its tooling requirement into the living developer-tooling spec.

Rollback consists of reverting this behaviour-preserving source conversion and any coordinated resolver support.

## Open Questions

- None. Shared explicit-extension resolver support is coordinated with the parent migration batch.
