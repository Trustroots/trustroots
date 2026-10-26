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

The initial vocabulary covers brand and text colours, surfaces, typography,
component padding, radii and notification badge colours. Padding names describe
the existing component sizes, not a new spacing scale. Existing styles continue
to use Less and Bootstrap; the React notification dot is the first consumer.

This is the first slice of issue #3248. Tailwind integration, owned primitives and
screen migrations follow separately. The architecture proposal reserves
`packages/ui` for the eventual shared owner; this bridge does not create a second
UI module or move build tooling. Existing runtime layout properties such as
`--tr-header-height` remain owned by their layout components.
