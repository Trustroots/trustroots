## Why

Issue #3234 requests consistent Android search and filter controls. Circle and
conversation filters have no clear action, while submitted member and place
searches have no clear action or filled primary search button. Shared controls
will make these interactions consistent and prepare their labels for translation.

## What Changes

- Introduce shared, fully rounded filled controls for live filters and submitted
  searches, preserving the search-mode menu where present.
- Give live filters a leading search icon and submitted searches a trailing
  rounded primary search button. Show an accessible Clear button for non-empty
  input, before the submit button where applicable.
- Use XML string resources for the affected field and action labels.
- Clearing a live filter restores all rows immediately. Clearing member search
  removes results and errors without submitting an empty search. Clearing place
  search dismisses suggestions while preserving the current map and filters.
- Prevent responses from cleared or replaced submitted queries from restoring
  old member results, moving the map or displaying obsolete lookup errors.

## Impact

Only the native Android circles, inbox, member search and place search controls
change. No new dependencies, server changes or data migrations are required.
This builds on the source organisation in PR #3260. Other forms, headers, dark
mode and the remaining architecture work in #3234 stay separate.
