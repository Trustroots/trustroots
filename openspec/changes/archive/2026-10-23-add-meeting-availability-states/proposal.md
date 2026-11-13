# Add explicit meeting availability states

## Why

The boolean meeting preference cannot distinguish an unanswered question from a refusal or a tentative invitation. Members need to update this independently on their profile and in the offer editor.

## What Changes

- Replace the unreleased PR's boolean preference with `meetingStatus`: yes, maybe, no, or not-set (default).
- Reuse a labelled, coloured radio control on the owner profile and offer editor.
- Show affirmative, tentative and unavailable descriptions separately from accommodation; hide unanswered availability from visitors and prompt the owner.
- Include yes and maybe in meeting discovery using the existing shared fuzzy location and meeting marker. Preserve all privacy restrictions.
- Save profile changes directly for an existing location offer; link to the location editor when no saved location exists.

## Impact

Offers persistence, API contracts, profile/editor controls, search labels and regression tests. This replaces an unreleased PR field; existing offers without the new field remain not-set and are not opted in automatically.
