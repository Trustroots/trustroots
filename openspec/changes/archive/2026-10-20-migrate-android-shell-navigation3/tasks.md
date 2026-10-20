## 1. Navigation 3 top-level shell

- [x] 1.1 Add stable Navigation 3 runtime/UI and only the compatible
      serialisation support needed for saveable navigation keys.
- [x] 1.2 Model Circles, Search, Messages and Profile as safe serialisable
      `NavKey` visit values with unique per-visit identity and render the
      authenticated top-level shell with `NavDisplay`.
- [x] 1.3 Preserve tab-origin history, tab reselection resets, notification
      navigation, analytics tracking and live session ownership.
- [x] 1.4 Preserve menu/browser/nested flows and route their Back handling ahead
      of top-level stack pops; keep form leave guards around navigation.
- [x] 1.5 Add journey coverage for cross-tab Back origins, tab reselection,
      notification/deep-link routing, form leave guards, activity recreation
      and predictive Back cancellation where supported by the existing test
      environment.
- [x] 1.6 Update the living `native-android-member-app` spec and archive this
      change after implementation is complete.

Menu pages, browser routes and other nested flows remain follow-up work for
issue 3234. The later migration will give those flows explicit route keys and
preserve origin-aware Back behaviour before removing their legacy state.
