## 1. Proposal

- [x] 1.1 Update the source-organisation design, tasks and capability delta to
      cover the final integrated ownership map; strict-validate before moves.

## 2. Move current integrated sources

- [x] 2.1 Move Circles screen, route keys, ViewModels and description helpers
      into `ui/circles`.
- [x] 2.2 Move HostDetail screen and ViewModel into `ui/hostdetail`.
- [x] 2.3 Move HostMap screen, ViewModel, result card and map-only helpers into
      `ui/hostmap`, splitting only substantial helpers where useful.
- [x] 2.4 Split `HostAndAccountScreens.kt` into HostOffer, APK update settings
      and Experience screen files; move HostOffer and Experience ViewModels.
- [x] 2.5 Move Menu route keys, display, screen and links into `ui/menu`;
      preserve the Java names of persisted route types and add a Navigation 3
      SavedState round-trip regression.
- [x] 2.6 Move Search hub and route keys into `ui/search` without changing
      route names or ownership.
- [x] 2.7 Move Startup into `ui/startup`; move build date, navigation bar,
      shared navigation links and usage analytics settings into `ui/common`.
- [x] 2.8 Keep root shell coordination, `Destination`, existing feature
      packages and ViewModel owners in place; retain explicit imports.

## 3. Reconcile references and preserve coverage

- [x] 3.1 Enumerate and update production, unit-test and instrumentation-test
      references for every moved declaration.
- [x] 3.2 Keep feature ViewModel tests with their feature packages; retain the
      established Android journey suite in `ui` with explicit feature imports.
- [x] 3.3 Remove emptied former source files and verify there are no forwarding
      declarations, compatibility aliases, duplicate symbols or old imports.
- [x] 3.4 Confirm every moved implementation retains its routes, state,
      ViewModel owners, callbacks, resources and existing test assertions/counts.
- [x] 3.4a Execute the new Menu Navigation 3 SavedState round-trip regression;
      all four Menu route tests passed, including legacy EditProfile and
      omitted support-link values.
- [x] 3.5 Strict-validate the completed OpenSpec change and update the living
      `native-android-member-app` requirement before archiving after validation.
- [x] 3.6 Freeze source for root-owned Android and repository checks; do not
      run builds or tests in this source-organisation task.
