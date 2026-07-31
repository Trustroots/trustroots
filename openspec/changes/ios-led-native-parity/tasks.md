## 1. Establish the native parity contract

- [x] 1.1 Define iOS-led native product parity and its platform boundaries.
- [x] 1.2 Define exact parity, Android-native adaptation and not-applicable
      classifications.
- [x] 1.3 Add iOS and Android capability deltas for applying the shared
      workflow.

## 2. Deliver the initial Android parity slice

- [x] 2.1 Align signed-out Android sign-in hierarchy and build metadata with
      the reference native presentation.
- [x] 2.2 Make the sign-in screen safe-area-aware, keyboard-aware and
      scrollable on constrained displays.
- [x] 2.3 Keep the configured API origin out of the signed-out screen and
      available from the signed-in menu.
- [x] 2.4 Select the signed `connect.sid` member session from all
      `Set-Cookie` response values.

## 3. Verification

- [x] 3.1 Add a regression unit test for a sign-in response containing both a
      routing cookie and the member-session cookie.
- [x] 3.2 Run the Android unit tests and lint.
- [ ] 3.3 Verify the sign-in layout with the keyboard open and on a constrained
      device display.
- [x] 3.4 Validate this OpenSpec change in strict mode.

## 4. Deliver the signed-in Android shell

- [x] 4.1 Replace the temporary top icon row with labelled Circles, Search,
      Messages and Menu bottom navigation.
- [x] 4.2 Load the established circle list and present loading, empty, error
      and retry states.
- [x] 4.3 Load authorised accommodation offers and display them on an
      interactive native map with map attribution.
- [x] 4.4 Load the established conversation inbox and present participant,
      excerpt, unread, loading, empty, error and retry states.
- [x] 4.5 Invalidate the stored session consistently when a destination API
      returns an authentication failure.
- [x] 4.6 Add decoder and destination-state regression coverage.
- [ ] 4.7 Verify all four destinations and persistent bottom navigation on the
      Android simulator.

The initial change does not add a new server or browser journey, so a web
end-to-end test is not applicable. Android contract logic is covered by the
regression unit test; native layout is verified with Android tooling and device
review.
