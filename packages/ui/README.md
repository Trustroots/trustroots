# Shared UI primitives

Import directly from `@trustroots/ui/Button`, `Alert`, `Badge` or `Spinner`.
They accept caller-supplied text and do not depend on translations or feature
modules. Styles use the web client's `--tr-*` tokens and are included by the
components. `Button` is non-submitting by default; set `type="submit"` when
needed. `Alert` currently provides the warning appearance and alert semantics;
`Spinner` requires a translated `label` supplied by its caller.

These are initial primitives, not complete replacements for Bootstrap. Add
variants only when a real consumer needs them, keeping keyboard access and
existing appearance in mind.
