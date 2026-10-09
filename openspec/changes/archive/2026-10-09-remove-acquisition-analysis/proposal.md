# Remove acquisition analysis and redundant utility dependencies

## Why

The acquisition analysis screen exposes statistical metrics without actionable interpretation. Its removal also eliminates the term-processing dependencies. Narrow runtime utilities can be replaced by native Node.js APIs and focused application code.

## What Changes

- Remove the acquisition Analysis page, navigation, API, access-policy entries and term analysis implementation. **BREAKING**: the former analysis URLs are no longer supported.
- Keep the acquisition stories list and administrator/Greeter access to it.
- Remove wink-statistics, wink-tokenizer and pluralize, plus direct mongoose-integer, uuid, del and express-paginate dependencies.
- Use schema integer validation, native UUID generation and file removal, and local pagination middleware preserving query defaults, bounds, offsets and Link headers.

## Impact

Affected modules: admin, core, tribes, users, Express configuration and email export tooling. No database migration is required. Deploy browser and server assets together. Existing analysis bookmarks no longer resolve to an analysis screen. UUID may remain as a transitive dependency.
