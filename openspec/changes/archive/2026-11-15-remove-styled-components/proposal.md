## Why

The web client still has 22 consumers of runtime-injected styled-components, despite the shared UI package and the repository's CSS utility and stylesheet conventions. Keeping a second runtime styling system adds dependency and rendering complexity and makes styling behaviour harder to audit consistently.

## What Changes

- Migrate the remaining styled-components consumers to existing shared UI components where appropriate, static utility classes, or scoped local stylesheets.
- Preserve current markup semantics and visual behaviour, including responsive sizes, interaction states, and direction-sensitive presentation.
- Remove styled-components from the application manifest and regenerate the pinned lockfile.

## Capabilities

### New Capabilities

- `web-styling`: Web client styling uses shared UI, static utility classes, or local stylesheets without runtime-injected styled-components.

## Impact

Affects 22 React components across core, experiences, messages, references-thread, search, statistics, tribes, and users. No API or data changes are required. The `classnames` dependency remains untouched for independent work based on the same mainline revision.
