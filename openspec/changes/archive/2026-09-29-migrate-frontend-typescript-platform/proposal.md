# Migrate core, messaging and support client modules to TypeScript

## Why

The initial client TypeScript integration is in place, but most shared platform, messaging and support browser code remains unchecked JavaScript. Converting these modules gives the client application strict type coverage across shared UI/runtime utilities and key member workflows while preserving the existing bundler, public imports and behaviour.

## What Changes

- Convert all production `.js` modules under `modules/core/client`, `modules/messages/client` and `modules/support/client` to `.ts` or `.tsx` as appropriate.
- Keep existing client tests in JavaScript unless a specific TypeScript import boundary requires a source change; preserve their behaviour and coverage.
- Add meaningful strict types at module and JavaScript integration boundaries without broad `any` types or compiler/lint/coverage exceptions.
- Preserve runtime behaviour, translated strings, module exports and public import compatibility.

## Compatibility

This is a source-only, behaviour-preserving migration. Babel continues to emit the existing browser bundle and JavaScript consumers retain compatible module paths through Webpack's `.js` extension aliases and Jest's matching module mapper. `resolveJsonModule` and the narrowly required declaration packages support strict typing. Ambient declaration-only files are excluded from executable coverage because they emit no runtime code; executable modules remain covered. There are no API, data, deployment or user-facing changes. Existing client tests and the production Webpack build validate the conversion; no new end-to-end scenario is warranted.
