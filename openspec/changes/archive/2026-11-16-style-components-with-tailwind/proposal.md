## Why

Replacing styled-components with component-local stylesheets would leave two conventions for new web component styles. Use the existing Tailwind utilities for this migration and for future component work.

## What Changes

- Move the component styles introduced by the styled-components removal into Tailwind utilities.
- Prohibit component-scoped stylesheets, including CSS Modules, in new or migrated web components.
- Keep existing global styles and vendor stylesheets available during the migration.

## Capabilities

### Modified Capabilities

- `web-styling`: Require Tailwind for new and migrated static component styling while preserving presentation and behaviour.

## Impact

The follow-up changes the stylesheet implementation and contributor guidance. It does not change APIs or stored data.
