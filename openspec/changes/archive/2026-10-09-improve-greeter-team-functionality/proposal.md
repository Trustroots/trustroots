# Improve greeter team functionality

## Why

Greeters need clearer signup visibility and filtering, public recognition and recruitment, and reply statistics that do not penalise members for unanswered welcomes or tiny samples (issue #3035).

## What Changes

- Explain hidden signup profiles and filter acquisition stories by visibility alongside assignment.
- Add an independent public greeter badge and `/team/greeters` page with eligible roster and volunteering link.
- Add `GET /api/greeters` with only public identifiers and display names.
- Exclude current greeter-initiated conversations from reply statistics and require three eligible conversations.
- Personalise empty conversations with the recipient's public display name or username.

## Impact

Affected modules: admin, users, pages, messages, React route registration, and end-to-end tests. Existing role permissions and assignment behaviour remain. Reply statistics change for existing accounts on read; no database migration or backfill is required. Public profile responses gain an allowlisted `isGreeter` boolean. New public copy uses British spelling and existing translation namespaces.
