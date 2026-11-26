# Web design tokens

The web client imports shared `--tr-*` CSS custom properties from
`packages/ui/src/globals.css` through `config/client/styles/tailwind.css`. The
Vite build includes them in both LTR and RTL stylesheets. Edit the web tokens
in the UI package. The remaining Less styles still use compile-time variables
from `modules/core/client/less/global-variables.less` and its imports.

Global stylesheets and React style props can reference the same values:

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
example `tw:bg-danger`. Tailwind colours such as `brand-primary`, `danger` and
`link` refer to the shared CSS tokens. Components pick a colour through a shared intent (`primary`,
`neutral`, `success`, `warning`, `danger`, `info` or `inverse`; see
`packages/ui/src/lib/intent.ts`), which reads the `--tr-*` tokens directly.
Tailwind Preflight is disabled. Unlayered Tailwind utilities can override
global defaults such as legacy button and form styles. Selectors with
higher specificity still win. Use
complete, static utility names in web components so Tailwind can discover them.
Component-scoped stylesheets and CSS Modules are prohibited for new and migrated
styles. React style props can supply values derived from runtime data.

The tokens cover brand and text colours, surfaces, typography, component padding,
radii and notification badge colours. Padding names describe existing component
sizes. Existing runtime properties such as `--tr-header-height` remain owned by
their layout components.
