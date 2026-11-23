## Why

ESLint and Prettier need a dozen plugins and configs, a FlatCompat bridge for the legacy configuration and a Prettier pass inside every lint run. oxlint and oxfmt cover the same rules and formatting from two native binaries, with TypeScript configuration files, and lint the whole repository in a fraction of the time.

## What Changes

- Replace ESLint with oxlint, configured in `oxlint.config.ts`. Port the rules from the ESLint presets in use (core recommended, TypeScript recommended, React, jsx-a11y, import) and the repository rules that oxlint implements.
- Replace Prettier with oxfmt, configured in `oxfmt.config.ts` with the existing Prettier options, and check formatting as its own step instead of through an ESLint rule.
- Update the package scripts, module manifests, lint-staged, the Linter workflow and the documentation. CI annotates oxlint results directly with its GitHub format instead of through reviewdog.
- Remove ESLint, Prettier and their plugins from the dependencies.
- Reformat the repository with oxfmt in a separate commit listed in `.git-blame-ignore-revs`.

## Impact

Developer tooling only: no runtime, user-facing, data or deployment change. Rules without an oxlint equivalent are dropped: `import/no-unresolved` (TypeScript and the bundler resolve imports), `react/no-access-state-in-setstate`, `react/no-deprecated`, the jest-dom and testing-library rules, and the custom anchor-content selector. The package boundary, module graph and module manifest guards are unchanged.
