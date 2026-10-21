# Update public network and recent activity statistics

## Why

The public network statistics omit supported Couchers.org profile links and do
not identify Couchsurfing connections as legacy. Visitors also cannot see recent
signup, conversation and message activity over rolling daily and weekly windows.

## What changes

- Include Couchers.org member counts and percentages in public statistics.
- Label Couchsurfing connections Legacy alongside Facebook and GitHub and explain
  that legacy percentages represent previously linked accounts.
- Cover the API results, failure handling and public presentation with tests.
- Add signup counts for the past 24 hours and 168 hours to the Members card.
- Add a table of new conversations and messages sent over the same periods.
- Calculate both windows from one instant, excluding future-dated records and
  excluding hidden or spam messages from sent-message counts.

## Impact

- Affected spec: public-access.
- Affected code: statistics controller, statistics component and translations.
- Signup counts include all registered accounts; the existing member total
  remains the number of public members. Thread counts use the first message of
  a conversation, so replies do not create additional new threads.
