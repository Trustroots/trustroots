# Compare the Compose pilot and SwiftUI on iPhone

Run both journeys on the same iPhone from the same Debug build. Record the
commit, iPhone model, iOS version, Xcode version and test server. Use a separate
development app identifier when the App Store app is installed. In Xcode, select
the paired iPhone and a development team that can sign that identifier. Record
whether signing, installation and launch succeed. The
[iOS build instructions](README.md#generate-and-build) list the pinned Compose
toolchain.

Use a test account with a populated profile and a conversation with another test
account on a controlled server. Sign in to the Debug build with the ordinary
**Trustroots** scheme. Add `--shared-member-pilot` to **Edit Scheme → Run →
Arguments Passed On Launch**, then run again. Disable the argument for the
SwiftUI pass. Use the same account and conversation in both passes. Restore
connectivity, clear any test draft and sign in again as needed before repeating
a case.

Relaunch Compose through Xcode so it receives the launch argument each time.
Connect the iPhone by USB for the Airplane Mode cases so Xcode can still
relaunch the app with Wi-Fi turned off.

A separate Debug build can open directly into Compose from the Home Screen by
setting the Boolean `TrustrootsSharedMemberPilot` to `true` in its Info.plist.

| Area                      | On-device procedure                                                                                                                                                                                                  | Record for SwiftUI and Compose                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Session and navigation    | Sign in, open your profile, open the inbox and a conversation, and navigate back. Background and reopen the app, then force quit and relaunch. In Compose, return to the dashboard and choose **Exit shared pilot**. | Session retention, extra sign-in prompts, Back behaviour and the destination after exiting.                                              |
| VoiceOver and larger text | Enable VoiceOver and select a larger accessibility text size. Navigate from the inbox into a conversation, compose a reply and go back using VoiceOver. Repeat on a member profile.                                  | Focus order and restoration, spoken control labels, clipped content and actions that become hard to reach.                               |
| Keyboard and insets       | Open a populated conversation, focus the composer and type a multiline reply. Dismiss and reopen the keyboard, then send to the test account.                                                                        | Whether the latest message, composer and Send action stay reachable, and where the view scrolls after sending.                           |
| Cached data               | Load the profile, inbox and conversation online. Enable Airplane Mode, confirm Wi-Fi is off, relaunch and reopen those screens. Restore connectivity and load the inbox again.                                       | Available cached data, saved-data label and timestamp, and whether a successful live request clears the indicator.                       |
| Offline reply             | With the conversation cached, go offline and try sending a distinctive test reply. Relaunch offline and reopen the conversation. Reconnect, retry once and check the recipient account. Reopen the composer.         | Whether the text survives relaunch, when it is sent, how many copies arrive and whether the composer clears after success.               |
| Refresh and revocation    | On a controlled server, expire the access token while leaving refresh valid. Relaunch online and open the inbox. Then revoke that session and repeat.                                                                | Whether refresh preserves the session, what the expired-session prompt says and whether the app stays signed out after another relaunch. |

Use **Pass**, **Gap** or **Blocked** for each result, with the observed behaviour
and any available screenshot from the test account. If the server cannot force
access-token expiry or session revocation, record that case as **Blocked**.
Record a missing feature with the screen where it would be expected. Attach the
results to [the migration issue](https://github.com/Trustroots/trustroots/issues/3232)
and estimate the engineering work for the gaps that would prevent switching a
default destination.
