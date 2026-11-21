# Link to an Experience already shared

## Why

Profiles keep advertising the Share action after a visitor submits an
Experience. The duplicate form protects the record, but the action should
take the author to the Experience they already wrote. This is part of #3750.

## What changes

- Reuse the existing signed-in pair lookup for normal profile actions.
- Show a link to the author's existing Experience when they have shared one.
- Preserve the ability to share or reply when the pair has no authored record.
- Keep the existing limited profile and reply access for blocked members.
