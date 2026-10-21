# Optional hosting details in messages

## Why

Members should be able to discuss a visit in their existing conversation without
creating a separate request workflow. Hosting reminders belong beside a hosting
message, while ordinary contact remains available.

## What Changes

- Add an optional hosting mode to the existing composer on web, Android and iOS.
- Attach guest count (default one) and optional arrival/departure dates to a message.
- Show the recipient's hosting description and a gentle reading reminder in hosting mode.
- When a host opts in, require acknowledgement for the first visible hosting message
  in that conversation, including conversations with ordinary message history.
- Restrict hosting reply shortcuts to unanswered incoming hosting messages.
- Render hosting details inside the same conversation; no booking statuses,
  separate inbox, date-edit API or scheduled reference reminders are introduced.

## Affected Modules

Messages owns the optional metadata and a hosting-context read endpoint. Offers
continues to own the opt-in preference and description. The existing intentional
messages-to-offers dependency is retained.

## Compatibility

Existing messages need no migration. Existing clients may continue sending ordinary
messages and reading their text; unknown optional hosting metadata is ignored.
All current native and web clients gain the new hosting UI together. The old
first-contact acknowledgement gate is replaced, not applied to ordinary messages.
