## Context

The client route table assigns a page component to each browser route. It lived in `modules/core/client/react-app/routes.tsx`, so the module-graph check recorded a link from `core` to every feature that table imported.

## Decision

The route table moves to `layers/shell`, which is not a feature module. The shell may import features. Feature modules do not import the shell. The old path re-exports the same functions so open pull requests that import it do not need a rewrite.

The header, avatar and circle menu stay in `core` for this change. Those remaining links are a separate step.
