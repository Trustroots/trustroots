## 1. Navigation ownership and Back dispatch

- [x] 1.1 Define serialisable route keys for each child flow with unique visit
      identity and minimal safe resource identifiers.
- [x] 1.2 Add one child stack per `MemberTabVisit` and retain existing top-level
      Navigation 3 history semantics.
- [x] 1.3 Centralise toolbar, system and predictive Back precedence across
      transient presentation state, child routes and the shell stack.
- [x] 1.4 Apply leave guards before every route mutation, including alert
      navigation, browser close and tab reselection actions.
- [x] 1.5 Add route entry decorators and establish per-entry ViewModel
      ownership; document how saved-state keys are kept free of secrets.

## 2. Menu, browser and circles routes

- [x] 2.1 Migrate Profile menu, own profile, edit profile, contacts, host offer
      and Account menu pages into typed routes.
- [x] 2.2 Represent Nostroots and support browser pages as child routes; preserve
      WebView history and runtime-only authentication cookies.
- [x] 2.3 Give each Circles tab visit a nested stack whose actual overview
      entry owns the existing list/filter/membership ViewModel and saveable
      scroll state; remove `selectedCircle` and inline detail composition.
- [x] 2.4 Push a decorated `CircleDetailVisit(slug, visitID)` whose genuine
      `CircleDetailViewModel` independently loads the circle by slug, its
      membership state, join/leave mutation, typed failures and retry through
      existing API endpoints; use no detail payload in the route key.
- [x] 2.5 Return detail membership changes to the retained overview owner
      without reloading its catalogue; preserve filter and scroll state across
      Back and Activity recreation, and independently restore detail by slug.
- [x] 2.6 Preserve same-tab reset actions and cover menu, browser and circle
      toolbar/system/predictive Back origins, unknown-slug retry, membership
      update and authentication invalidation.
- [x] 2.7 Add focused overview/detail ViewModel unit coverage for catalogue
      and detail loading, filter retention, membership events, mutation failure
      and retry, cancellation/stale results, authentication invalidation,
      account replacement, and normalized backend/session environment changes
      without duplicate loads or membership mutations.
- [x] 2.8 Add anonymous real-Activity Navigation 3 journeys for overview →
      detail → recreation → Back, filter/list-scroll retention without a
      duplicate catalogue request, detail reload by slug, membership success
      reflected on overview, unknown-slug retry and same-tab reset. Assert
      route keys contain no circle payload or credentials.

## 3. Search and map routes

- [x] 3.1 Model Map and Members as serialisable `SearchModeVisit` routes under
      the actual decorated shell `MemberTabVisit(Destination.Search, visitID)`;
      replace the current mode route on selection and preserve initial-mode
      Back behaviour without synthetic route owners.
- [x] 3.2 Acquire `MemberSearchViewModel` and `HostMapViewModel` from the
      outer Search visit before child NavDisplay composition; retain them while
      mode, profile or HostDetail routes are current.
- [x] 3.3 Push a safe `HostDetailVisit(offerID, offerType, visitID)` from a map
      result. Use the app-local `SearchOverlaySceneStrategy` metadata to retain
      the same map entry beneath the bottom-aligned HostDetail surface and
      profile overlay; use `SinglePaneSceneStrategy` for ordinary mode routes.
- [x] 3.4 Add a genuine entry-owned `HostDetailViewModel` and repository that
      load canonical offer, profile and membership data through existing API
      reads, with retryable failures, cancellation/stale-result checks and
      one-shot auth invalidation. Move selected offer/profile/membership
      business state out of `HostMapViewModel`; keep route keys free of payloads.
- [x] 3.5 Keep filters, notes, place suggestions and confirmations transient
      under their owning route. Preserve map viewport, filters, query
      fingerprint and note-source lifecycle while the overlay is shown.
- [x] 3.6 Push member profiles above the actual source mode or HostDetail route;
      verify Back restores the exact source and host profile Back returns to
      HostDetail before returning to Map.
- [x] 3.7 Preserve Search reselection reset to the Map root and existing
      visit-scoped reset generation, including default camera/filters and
      cleared member-search state.
- [x] 3.8 Cover Map↔Members root Back for visits initially opened in each mode,
      toolbar/system/predictive child Back, host-detail/profile origins,
      Activity recreation, detail retry/auth/cancellation, map retention and
      reset using anonymous real-Activity journeys and focused ViewModel tests.

## 4. Messages and profile routes

- [x] 4.1 Model `Inbox → Conversation → MemberProfile` as a nested route chain
      and retain inbox state when a conversation closes.
- [x] 4.2 Route message alerts to a Messages tab visit and requested
      conversation while preserving the prior top-level origin history.
- [x] 4.3 First profile slice: keep Contacts as the actual Menu child entry,
      move its loaded list/loading/error/refresh state to that entry's
      ContactsViewModel, and expose an explicit `onOpenProfile(username)`.
- [x] 4.4 Push a real decorated `MenuMemberProfileVisit(username, visitID)`
      from Contacts; preserve the Contacts entry/list under it, derive
      `UsageScreen.Profile`, and restore Contacts usage after Back.
- [x] 4.5 Cover Contacts row callback behaviour and real Menu→Contacts→profile
      toolbar/system Back, Activity recreation, and Menu reselection clearing
      both the profile and Contacts owners; retain existing Contacts failure,
      empty-list and no-username coverage.
- [x] 4.6 Route member-search and map/host-result profile openings on their
      existing Search stack in a separate slice; preserve the source state and
      test each exact origin/Back path.
- [x] 4.7 Establish a per-entry `MemberProfileViewModel` from the actual
      decorated profile route owner for canonical profile, hosting, contacts,
      references, relationship and contact-removal business state; retain the
      opener's saveable pager/list state across child-route disposal.
- [x] 4.8 Replace related-profile selection with a decorated
      `MemberProfileVisit(username, visitID)` child entry and preserve the
      opening profile visit. Extract profile entry content so the route does
      not recursively compose `MemberProfileScreen`; keep photo, confirmation,
      browser, Conversation, Experience and guarded Edit Back precedence intact.
- [x] 4.9 Replace profile conversation selection with a decorated
      `ProfileConversationVisit(memberID, visitID)` and render the independent
      `MessageConversationEntryScreen` using that entry's ViewModel owner; do
      not depend on an Inbox entry or copy profile/inbox payload into the key.
- [x] 4.9a Verify Profile → Conversation → the exact same Profile after
      toolbar/system Back and actual Activity recreation; verify distinct
      stores for repeated visits to the same member from separate profile
      visits and confirm the retained profile data/pager/list state does not
      refetch or reset.
- [x] 4.10 Move own-profile and direct Menu editing into decorated Edit entries;
      own each form's canonical load, HTML normalisation, dirty guard and save,
      and define safe process-restoration behaviour. Keep the fast profile
      snapshot handoff in a ViewModel scoped to the actual enclosing decorated
      entry owner, keyed by parent profile visit ID; process death falls back to
      canonical reload by username.
- [x] 4.11 Move experience creation into a decorated Experience entry and
      preserve its recipient and opening profile route. Return through a typed,
      one-shot completion keyed by the exact parent profile visit ID.
- [x] 4.12 Move profile contact-add selection into a decorated
      `ProfileBrowserVisit(ContactRequest, username, memberID, visitID)`;
      derive localized title and URL at runtime and supply cookies only to the
      WebView at runtime. Keep URL/title/cookie/request payload out of the key.
- [x] 4.12a Verify browser-history Back stays inside the WebView before the
      browser entry closes, the next Back restores the exact profile entry,
      and browser route recreation uses the current session cookie without
      restoring credentials or private payloads.
- [x] 4.13 Retain image viewing and confirmations as transient presentation
      state, consuming Back before the active Navigation 3 route is popped.

## 5. State, restoration and cleanup

- [x] 5.1 Move navigation-sensitive screen state and event handling into
      entry-scoped screen ViewModels in focused screen-family changes. Profile
      edit/experience handoffs use the existing enclosing decorated entry
      owner, clear on route removal or backend/account/cookie replacement, and
      never place profile payloads or labels in route or saved state.
- [x] 5.2 Verify supported nested-route restoration after the encrypted live
      session is restored. Preserve published Java class names and route values
      for the existing Menu page and browser keys, including the legacy
      `MenuPage.EditProfile` route using the current session username. Exercise
      the actual Navigation 3 NavBackStack/SavedState serializer round-trip for
      Menu page and browser entries. Retain the existing Activity recreation
      journey; verify the supported runtime fallback for a missing or unknown
      `supportLinkID`. Unknown serialized NavKey class names are outside this
      change's contract and require no fallback feature.
- [x] 5.3 Verify repeated tab visits have distinct child stacks and ViewModel
      stores and that removed entries release their stores.
- [x] 5.4 Remove migrated mutable route selectors and obsolete Back handlers
      after all callers use the Navigation 3 routes.
- [x] 5.5 Add or retain anonymous Android journey coverage for route origins,
      toolbar/system/predictive Back, dirty-form guards, notification entry,
      tab resets and activity recreation.
- [x] 5.6 Specifically verify Search mode and HostDetail saved keys contain
      only mode/resource ID/type/visit ID; verify overlay Back leaves camera,
      filters and notes untouched and does not issue duplicate completed map
      requests or recreate the notes source.
- [x] 5.7 Reconcile the nested-route, exact-origin Back, overlay, supported-key
      restoration and child-state-lifetime requirements into the existing
      `native-android-member-app` feature requirements without duplicating
      broader requirements. Archive this change after implementation and
      validation are complete.

## Activity-journey evidence

- `Navigation3MemberShellJourneyTest.repeatedTabVisitsRestoreAcrossActivityRecreationAndPredictiveBack`
- `Navigation3MemberShellJourneyTest.circlesVisitRetainsAccountStateAndFreshVisitsResetAndReload`
- `Navigation3MemberShellJourneyTest.circleDetailUsesItsOwnEntryAndRestoresFilterAndMembershipAcrossRecreation`
- `Navigation3MemberShellJourneyTest.missingCircleDetailCanRetryAndPredictiveBackReturnsToFilteredOverview`
- `Navigation3MemberShellJourneyTest.circleDetailRouteSerialisesOnlyCanonicalSlugAndVisitID`
- `Navigation3MemberShellJourneyTest.memberSearchStateSurvivesModeTabAndActivityChangesAndResetsOnReselection`
- `Navigation3MemberShellJourneyTest.mapVisitRetainsCameraAndFiltersAcrossActivityRecreationWithoutRepeatingItsQuery`
- `Navigation3MemberShellJourneyTest.hostDetailDialogRestoresAboveTheSameMapEntryWithoutRepeatingRequests`
- `Navigation3MemberShellJourneyTest.expiredMemberSearchClearsTheSearchEntryForANewAccount`
- `Navigation3MemberShellJourneyTest.expiredHostMapClearsFiltersAndCameraForANewAccount`
- `HostMapMarkerJourneyTest.detailAndProfileRoutesKeepTheMapAndItsNotesConnectionAlive`

Root validation: the full Android build, unit tests and lint passed, and the
Android device run passed 368/368 tests. Repository checks passed. Follow-up
focused Android checks passed for the actual Navigation 3 SavedState
compatibility round-trip of shipped Menu route identities, legacy EditProfile
and omitted support-link values; the strengthened Activity-recreation
avatar-retention journey also passed.
