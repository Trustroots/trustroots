## 1. Specify the app session owner

- [x] 1.1 Add an `AppSessionViewModel` state/event contract for restore, sign-in,
      member update, explicit sign-out and authentication invalidation; keep the
      session cookie out of saved state and route keys.
- [x] 1.2 Inject narrow ports for secure-session load/save/clear, account cache
      cleanup and shell/sign-in owner cleanup; preserve existing concrete
      collaborators and cache key normalisation.
- [x] 1.3 Specify restoration fallback, 700 ms minimum Startup display, sign-in
      and member-update publication ordering, and explicit sign-out versus
      invalidation feedback.
- [x] 1.4 Specify backend changes as preserving the current session while
      clearing signed-out sign-in navigation and refreshing authenticated
      entry ViewModels through their current environment-update path.

## 2. Integrate with the signed-out Navigation 3 flow

- [x] 2.1 Obtain the app session model from the Activity owner and remove
      `session`, `starting` and `signedOutMessage` business state and store
      transitions from `TrustrootsApp`.
- [x] 2.2 Keep `TrustrootsApp` as the Startup/SignIn/MemberShell renderer and
      route owner; forward typed session events from SignIn and the shell.
- [x] 2.3 Preserve `SignInDestinationStoreHolder.activateBackend` behaviour,
      authenticated shell entry-store lifecycle, alert reconciliation and
      all current route keys without credentials.
- [x] 2.4 Serialise secure-store mutations and cache cleanup without claiming
      synchronous disk durability beyond the existing `apply()` semantics.
- [x] 2.5 Bind authenticated callbacks to runtime account/cookie/backend
      identity, reject stale callbacks and clear only in-memory state on final
      ViewModel destruction.

## 3. Test transitions and lifecycle

- [x] 3.1 Add anonymous fake-port unit tests for restoration, timing, sign-in,
      member update, sign-out, invalidation, cleanup ordering and transition
      races/cancellation.
- [x] 3.2 Add native Navigation 3 journeys for sign-in, child browser Back,
      sign-out, invalidation feedback, Activity recreation and backend change.
- [x] 3.3 Verify cookies stay out of navigation/saved state and that account
      cache/shell-owner cleanup uses the same backend and username as before.
- [x] 3.4 Cover stale invalidation/logout/member-update callbacks after account,
      cookie or backend replacement, no expiry feedback after sign-out, and
      late restore plus runtime-only cleanup on ViewModel clear.
- [x] 3.5 Run focused Android tests, lint/debug build and update the living
      native Android spec. Android verification passed: 17 unit tests and 7
      native journeys, plus lint and debug assemble.
- [x] 3.6 Run the repository check and archive the change after review.

Validation: `pnpm check` passed (253 client suites, 1,907 client tests and four configuration tests). Full Android compilation, unit tests, lint and debug/test APK assembly passed; the 17 focused session unit tests and seven native sign-in/session journeys passed.
