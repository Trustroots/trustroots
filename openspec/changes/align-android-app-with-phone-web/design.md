## Context

Trustroots members use a responsive website whose phone layout (≤767px) is the
established member product. The native Android app under `apps/android` already
shares the website-session API and a top primary bar of Circles, Search,
Messages and Menu. The remaining gap is journey and information-architecture
parity with that phone web experience, not a new hybrid shell.

The foundation MVP is tracked in `add-native-android-member-mvp`. This change
owns aligning Android UX with phone web and completing deferred member parity.

## Goals / Non-Goals

**Goals:**

- Treat phone web member IA and journeys as the Android product reference.
- Ship phased native parity without administration or moderation in the app.
- Prefer native Compose screens; use the allowlisted WebView only for deferred
  Trustroots flows.
- Keep the existing top four-destination shell.

**Non-Goals:**

- Pixel-perfect Bootstrap cloning in Compose.
- Admin or moderation tools in the app.
- Firebase Cloud Messaging (still follow-on under the MVP change).
- Redesigning the iOS app in this change.
- Moving Sign out onto the Menu (Android keeps it on Account only).

## Decisions

### Phone web as UX reference

Use the phone website (≤767px) as the source of truth for member destinations,
grouping and core journeys: logged-in header destinations, `/navigation` menu
contents (except Sign out), profile small navigation patterns, mobile search
chrome, and thread messaging behaviours. Native Material/Compose presentation,
spacing and controls remain Android-native.

Primary references:

- `modules/core/client/components/NavigationLoggedIn.tsx`
- `modules/pages/client/components/Navigation.component.tsx`
- Profile top/bottom small navigation components
- Mobile search page chrome and filters
- Message thread reply / QuickReply behaviours

### Shell

Keep Circles, Search, Messages and Menu as the top primary destinations. Do
not adopt iOS-style bottom tabs for Android under this change.

### Native versus WebView

- Native for journeys already in the MVP and for each parity phase as it lands.
- WebView for allowlisted Trustroots HTTPS routes that remain deferred (for
  example Host offer editing until the Host phase).
- Confirm before opening destinations outside the existing Trustroots/Hitchwiki
  allowlist.

### Sign out placement

Phone web puts Sign out on `/navigation`. Android keeps Sign out only on the
Account screen so destructive session exit stays one intentional step away from
the overflow menu. Menu still links to Account.

### Phasing

1. Menu parity with `/navigation` (minus Sign out), including a thin native
   Contacts list and Find people deep-linking into Search → Members.
2. Profile chrome equivalent to phone web sticky actions and sections.
3. Messaging parity (QuickReply, drafts, multiline compose, real unread count).
4. Search parity (filters sheet / place-search patterns closer to mobile
   `SearchPage`).
5. Native Host, experiences and remaining account settings (replace WebView
   Host where applicable).

## Risks / Trade-offs

- **Long-lived change** — Phases share one OpenSpec change so the north star
  stays visible; archive when the programme completes, or split only if the
  change becomes unmanageable.
- **Temporary WebView Host** — Menu exposes Host via WebView until phase 5;
  members can manage hosting without waiting for a full native Host editor.
- **Find people dual entry** — Available from Menu and from Search tabs, matching
  phone web discoverability while keeping Search as the map/members hub.

## Migration Plan

No server migration. Ship Android UI updates behind normal debug/preview APK
releases. Rollback is a prior app build; website behaviour is unchanged.
