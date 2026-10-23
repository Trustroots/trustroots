# AI-assisted translation proofreading

## Why

Translation contributors need a simple review workflow that keeps versioning in
Git and does not depend on Weblate. AI should prepare missing and changed
translations; humans proofread and correct them before publication.

## What Changes

- Add an independent React/TypeScript app at `apps/nostranslation`, published at
  `https://team.trustroots.org/nostranslation` through the existing Pages builds.
- Generate revision-bound, validated AI drafts with a bounded background job.
- Require a matching Trustroots NIP-05 identity and NIP-07 or NIP-46 signature
  before submitting reviewed strings as a draft GitHub PR.
- Preserve current locale formats, human translations, review attribution and
  normal CI/merge requirements. Never publish unreviewed AI output.
- Keep Weblate connected until a production acceptance PR succeeds; document
  the final disconnection and access-revocation steps.

## Impact

Adds a standalone Node 24 API and persistent SQLite volume for draft/retry state,
plus deployment-owned OpenAI and GitHub App credentials. No main-app database
migration or new links between application modules. Existing public NIP-05
eligibility applies, including the requirement for a public eligible profile.
