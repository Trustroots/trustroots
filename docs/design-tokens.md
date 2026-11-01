# Web design tokens

The web client exposes existing Less values as `--tr-*` CSS custom properties.
`config/client/styles/design-tokens.less` is imported once by the stylesheet entry
and included in both production LTR and RTL stylesheets. The values still come
from `modules/core/client/less/global-variables.less` and its legacy imports;
change values there rather than duplicating colour or dimension literals.

CSS, styled-components and React style props can reference the same values:

```css
.example {
  color: var(--tr-text-color);
  background: var(--tr-panel-bg);
  border-radius: var(--tr-border-radius-base);
}
```

```tsx
<span style={{ color: 'var(--tr-brand-primary)' }}>Example</span>
```

These references resolve in the browser cascade, so they do not need a JavaScript
theme object or a DOM lookup during rendering. Consumers that need literal values
for a non-CSS API must resolve them separately; CSS variables are not colour
strings for canvas or other non-CSS APIs.

The web Vite build also provides Tailwind utilities with the `tw:` prefix, for
example `tw:bg-notification`. The Tailwind theme tokens live in
`packages/ui/src/globals.css`, which `config/client/styles/tailwind.css` imports
once; the `brand-primary`, `brand-secondary`, `notification`, `neutral`
(`--tr-gray-light`, used by neutral badges), `success` and `warning`
(`--tr-status-success` and `--tr-status-warning`, used by status badges)
colours refer to the shared CSS tokens. Tailwind Preflight is not loaded while
Bootstrap remains in use. Tailwind utilities are unlayered and load after Bootstrap and the global
Less, so a utility class overrides element rules such as Bootstrap's
`button { border-radius: 0 }` and wins ties with Bootstrap classes. Module
stylesheets load later and win ties with utilities, and selectors with higher
specificity (for example `.btn-primary:hover`) still win; avoid combining
competing Bootstrap and Tailwind styles on an element. Use complete, static
utility names in source so Tailwind can discover them.

The initial vocabulary covers brand and text colours, surfaces, typography,
component padding, radii and notification badge colours. Padding names describe
the existing component sizes, not a new spacing scale. Existing styles continue
to use Less and Bootstrap; the React notification dot is the first consumer.

This is the first slice of issue #3248. Tailwind integration, owned primitives and
screen migrations follow separately. The architecture proposal reserves
`packages/ui` for the eventual shared owner; this bridge does not create a second
UI module or move build tooling. Existing runtime layout properties such as
`--tr-header-height` remain owned by their layout components.
