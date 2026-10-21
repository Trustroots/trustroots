## Implementation

- [x] Extend Navigation 3 child stacks and entry ownership across the
      authenticated member flows, sign-in destinations and embedded browser pages.
- [x] Preserve origin-aware toolbar, system and predictive Back, transient
      presentation handling, form leave guards, tab reset behaviour and alert
      navigation.
- [x] Keep route keys serialisable and limited to route identity and safe
      public identifiers; restore supported navigation state under the live
      authenticated session.
- [x] Add or retain local Android journey and ViewModel coverage for route
      origins, Back, restoration, reset, state retention and request lifecycle.
- [x] Reconcile the delivered behaviour with the existing
      `native-android-member-app` requirements without adding duplicate
      requirements.

## Validation and archival

- [ ] Complete combined Android validation in CI and review its results.
- [ ] Archive this change after validation succeeds.
