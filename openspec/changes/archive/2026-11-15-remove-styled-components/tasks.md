## Implementation

- [x] Migrate all remaining styled-components consumers, preserving HTML tags, classes, and visual states.
- [x] Remove styled-components from the manifest and regenerate the pinned lockfile.
- [x] Update the web styling requirement and archive this proposal.

## Validation

- [x] Adjust client tests where needed to preserve behaviour.
- [x] Run `pnpm check`, the production build, and the RTL stylesheet tests.
- [x] Run the affected Playwright journeys and compare desktop and mobile layouts with the baseline.
- [x] Confirm no production source imports styled-components remain and validate the archived change and living spec.
