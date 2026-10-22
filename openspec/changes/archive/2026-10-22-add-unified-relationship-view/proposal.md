# Add a unified relationship view

## Why

Contact status, Experiences and private message feedback describe different
parts of a member relationship but currently appear in separate places. Message
feedback is hidden on small screens. Members can also mistake a contact request
for permission to message or an endorsement of someone they have met.

This proposal defines the existing-records delivery for #2888. Implementation
delivers that scope using the existing contact, Experience and thread-feedback
APIs; the richer shared-data work remains in #3136.

## What Changes

- Add a private **Your connection** section to another member's profile and
  message thread, accessible on desktop and mobile through one shared component
  and typed view model.
- Show contact status and relevant existing actions, the viewer's Experience and
  publication state, the other member's permitted Experience information, and
  the viewer's own private message feedback and eligible yes/no controls.
- Label each account's author, keep differing accounts separate, treat missing
  meeting answers as not recorded, and express hosting from the author's
  perspective.
- Explain before sending or accepting a contact request that members can
  message without a contact and should only request or accept people they know.
  Update the add-contact guidance introduced for #2939 and cover acceptance too.
- Preserve existing APIs, publication and moderation rules, feature flags and
  restrictions. Writing an Experience remains independent of contact status.

## Scope and Compatibility

The delivery adds no relationship record, endpoint, migration or
dependency. Existing contact and Experience identifiers, counts, reference-thread
history and publication timers remain authoritative. Existing links and forms
continue to work. Deployment requires only the client changes.

Shared relationship data, persistent quick meeting entry, fact correction and
hosting-detail editing belong to #3136. This delivery does not introduce those
controls or silently change a published Experience. Changes to published
Experiences continue through the existing staff approval process. The unresolved
blocked-member Experience-writing requirement in #2536 is separate.

## Affected Modules

- `modules/contacts`: shared view and adapter, contact actions and guidance.
- `modules/experiences`: existing read/create links, permitted account details
  and publication presentation.
- `modules/references-thread`: viewer-only feedback and existing eligibility.
- `modules/users` and `modules/messages`: profile and thread integration.
- `tests/e2e`: profile/thread consistency and mobile access.
- OpenSpec capability: `relationships-safety`; existing
  `experiences-references`, `member-profiles` and `messaging` requirements remain
  in force.

The shared orchestration will need client imports from contacts into Experiences
and reference-thread APIs. Record intended module links with the repository's
baseline and workspace-package generators during implementation, explaining
that both surfaces use the same eligibility and privacy adapter.
