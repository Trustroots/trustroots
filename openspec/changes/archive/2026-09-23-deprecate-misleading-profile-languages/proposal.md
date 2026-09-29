# Deprecate misleading profile languages

## Why

The profile picker offers historical and non-language catalogue entries that members can select as spoken languages. Lingua Franca Nova has the same practical problem. The English name for Limburgish is also outdated in the catalogue.

## What Changes

- Mark the agreed 20 catalogue entries as deprecated and prevent members from adding them to profiles.
- Keep existing deprecated selections visible and removable without changing stored language codes.
- Use “Limburgish” as the English label for `lim`.

## Impact

Affected areas: generated language catalogue, languages API, profile picker, and profile update validation. The array API gains a `deprecated` boolean on each entry; its existing fields and the object API remain compatible. No data migration is required.
