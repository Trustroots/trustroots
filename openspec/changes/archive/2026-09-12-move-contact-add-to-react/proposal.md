# Contact creation in the React shell

## Why

Extract the next bounded contact workflow from PR 2769 after contact confirmation has merged, without coupling it to the profile migration.

## What Changes

- Render `/contact-add/:userId` in the existing React shell and forward the Angular named state.
- Preserve member-only access, activation notices, editable messages, existing/pending contacts, self-connection rejection and API responses.
- Keep profile links and the current runtime and build tooling.

- Also move `/profile/:username/experiences/new` into a focused React page, reusing the existing experience form and keeping profile viewing and experience history in Angular. Preserve the experiences feature setting and return links.

## Impact

Route ownership, a page adapter, API wrappers and client/server/browser regression coverage. No database changes. Compatible dependency refreshes can accompany the route adapters.
