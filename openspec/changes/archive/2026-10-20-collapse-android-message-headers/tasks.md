## 1. Baseline and specification

- [x] 1.1 Add anonymous-fixture Android journeys that capture current inbox and
      conversation header screenshots and layout bounds before and after body
      scrolling.
- [x] 1.2 Run the baseline journeys on a device and record the current expanded
      header measurements before changing production UI.
- [x] 1.3 Validate this proposal and its native Android specification delta.

## 2. Collapsing message headers

- [x] 2.1 Add the shared `MemberLargeTopAppBar` in `ui/common`, following the
      Circles large app bar's Material 3 typography, colours, insets and
      `exitUntilCollapsed` scroll behaviour.
- [x] 2.2 Move the Messages overview title into the shared app bar and place the
      filter, loading/error feedback and empty state in the scrolling list.
- [x] 2.3 Move conversation participant title and Back action into the shared
      app bar and connect message scrolling to its collapse behaviour while
      preserving the fixed quick reply and composer area.
- [x] 2.4 Preserve inbox full-row conversation opening, Profile actions,
      filtering, conversation/profile Back origins, drafts, sending, quick
      replies, message order, IME behaviour, accessibility and supplied insets.

## 3. Verification

- [x] 3.1 Verify the app bars collapse to one title row on scroll and expand
      again when scrolling toward the top, with screenshot and bounds evidence.
- [x] 3.2 Verify inbox filtering/profile/conversation actions and conversation
      drafts, quick replies, send action, keyboard and scrolling journeys.
- [x] 3.3 Archive this change and update the native Android living spec.
