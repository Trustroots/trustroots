# Clarify username policy and preserve member names

## Why

PR #2726 already tightens username policy but lacks a proposal and browser regression coverage. Document that existing branch behaviour before completing the fixes, and preserve ordinary apostrophes in names.

## What Changes

- New and changed usernames contain 3–34 lowercase letters and digits, including at least one letter, and cannot be reserved names.
- Existing usernames remain valid for login, lookups, and unrelated profile saves.
- Names retain international letters, supported punctuation and emoji, including straight and curly apostrophes.
- Add end-to-end coverage for signup policy and existing-member compatibility.

## Impact

Affected modules: authentication service, signup, profile updates, NIP-05 and their tests. This formalises a breaking policy for new usernames already implemented on this PR. Existing accounts need no migration; no deployment configuration changes are required.
