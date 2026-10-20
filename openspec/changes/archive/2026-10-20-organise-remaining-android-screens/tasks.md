## 1. OpenSpec

- [x] 1.1 Validate the proposal, design, tasks, and Android source-organisation
      requirement before implementation.

## 2. Organise screen sources

- [x] 2.1 Split Host offer, experience creation, account settings, and APK
      update settings out of `HostAndAccountScreens.kt` into their feature
      packages.
- [x] 2.2 Move Circles, Host map and result card, Search hub and mode menu,
      Startup, Menu, and the member navigation bar into the specified packages.
- [x] 2.3 Move genuinely shared UI components and pure-data helpers into
      `ui/common`; retain shell coordination and `Destination` in `ui` root.
- [x] 2.4 Update production and test imports and test packages where needed; preserve
      required test visibility and remove old screen implementations.

## 3. Verify and complete

- [x] 3.1 Review package ownership and confirm no screen forwarding functions
      remain in former files.
- [x] 3.2 Run the existing Android compilation and relevant unit tests.
- [x] 3.3 Archive this change and update the living
      `native-android-member-app` specification.
