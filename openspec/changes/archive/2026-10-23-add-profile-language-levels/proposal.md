## Why

Members cannot indicate whether a listed language is suitable for conversation or one they are learning (#2867). The Language exchange circle already exists.

## What Changes

- Add optional Basic, Intermediate, Advanced and Native levels to selected profile languages.
- Show declared levels beside language names on profiles and messaging profile summaries.
- Retain the existing language-code array and store levels in a separate optional map. Existing clients and profiles remain compatible; no migration is required.
- Validate levels on the server and remove levels when their language is removed.

## Impact

Affected module: users (profile model, API, editing and display). No new module links or deployment steps.
