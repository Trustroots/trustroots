## 1. Navigation ownership and Back dispatch

- [ ] 1.1 Define serialisable route keys for each child flow with unique visit
      identity and minimal safe resource identifiers.
- [ ] 1.2 Add one child stack per `MemberTabVisit` and retain existing top-level
      Navigation 3 history semantics.
- [ ] 1.3 Centralise toolbar, system and predictive Back precedence across
      transient presentation state, child routes and the shell stack.
- [ ] 1.4 Apply leave guards before every route mutation, including alert
      navigation, browser close and tab reselection actions.
- [ ] 1.5 Add route entry decorators and establish per-entry ViewModel
      ownership; document how saved-state keys are kept free of secrets.

## 2. Menu, browser and circles routes

- [x] 2.1 Migrate Profile menu, own profile, edit profile, contacts, host offer
      and Account menu pages into typed routes.
- [x] 2.2 Represent Nostroots and support browser pages as child routes; preserve
      WebView history and runtime-only authentication cookies.
- [ ] 2.3 Migrate circle overview/detail to `CirclesOverview → CircleDetail`
      while preserving overview filters and return position.
- [ ] 2.4 Preserve same-tab reset actions and cover menu, browser and circle
      toolbar/system Back origins.

## 3. Search and map routes

- [ ] 3.1 Model map and member search modes as routes under each Search visit.
- [ ] 3.2 Model map host detail and member profile as child routes; retain map
      camera, filters and selected result beneath them.
- [ ] 3.3 Keep filter menus, notes, host sheets and confirmations as transient
      presentation state consumed before route Back.
- [ ] 3.4 Cover profiles opened from member search and map, host detail Back,
      switching search modes and same-tab reset.

## 4. Messages and profile routes

- [x] 4.1 Model `Inbox → Conversation → MemberProfile` as a nested route chain
      and retain inbox state when a conversation closes.
- [x] 4.2 Route message alerts to a Messages tab visit and requested
      conversation while preserving the prior top-level origin history.
- [ ] 4.3 Model member-profile related profiles, conversations and experience
      forms as child routes, preserving the opening profile route.
- [ ] 4.4 Cover profiles opened from messages, contacts, map, search and profile
      actions, with Back returning to the exact source route.

## 5. State, restoration and cleanup

- [ ] 5.1 Move navigation-sensitive screen state and event handling into
      entry-scoped screen ViewModels in focused screen-family changes.
- [ ] 5.2 Restore nested routes after activity recreation only after the live
      session is validated; safely fall back for missing or unknown keys.
- [ ] 5.3 Verify repeated tab visits have distinct child stacks and ViewModel
      stores and that removed entries release their stores.
- [ ] 5.4 Remove migrated mutable route selectors and obsolete Back handlers
      after all callers use the Navigation 3 routes.
- [ ] 5.5 Add or retain anonymous Android journey coverage for route origins,
      toolbar/system/predictive Back, dirty-form guards, notification entry,
      tab resets and activity recreation.
- [ ] 5.6 Update `native-android-member-app` living requirements and archive
      this change after implementation and validation are complete.
