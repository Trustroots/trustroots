# Encourage experience sharing from statistics

## Why

The public statistics page explains that the real-life connection count is a
lower bound because the experience feature only launched in 2021. Signed-in
members who have contacts can help make the count more representative, but the
page currently offers no direct way to contribute.

## What Changes

- Correct the real-life connection note to say that Trustroots did not have the
  experience feature until 2021.
- For a signed-in public member, select one random confirmed, public contact the
  member has not yet written an experience about.
- Show a short encouragement linking directly to that contact's new-experience
  page.
- Show a general experience-writing encouragement when a signed-in member has
  no eligible contact or the suggestion cannot be loaded.
- Do not show an experience-writing encouragement to visitors.

## Privacy and Eligibility

- The suggestion endpoint is authenticated and returns only the selected
  contact's public identifier, display name, and username.
- Pending, private, shadow-hidden, suspended, and blocked contacts are excluded.
- A contact is excluded once the signed-in member has written an experience
  about them. A contact who has written an experience about the signed-in
  member remains eligible so the member can write the matching response.

## Affected Modules

- `modules/experiences` (authenticated suggestion endpoint)
- `modules/statistics` (corrected copy and signed-in encouragement)
- `tests/e2e` (signed-in suggestion flow)
