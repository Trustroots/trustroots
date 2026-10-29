## Why

Issue #3248 calls for reusable UI owned by the project. A shared package can
provide small, accessible primitives without depending on feature modules.

## What Changes

- Add a private source-only `@trustroots/ui` package containing Button, Alert,
  Badge and Spinner primitives and styles based on shared design values.
- Replace one existing language-loading warning with the Alert primitive while
  retaining its message, semantics and appearance.
- Test the primitives and the existing warning in a browser.

## Impact

This builds on the prefixed Tailwind foundation. Existing Bootstrap components
remain during migration; application services and translations stay outside
the package. No API or database change is required.
