## Context

`MemberProfileScreen` measures `ProfileActionBar` separately, then renders
`ArtworkHero` with the section bar as bottom content. The action bar currently
uses a horizontally scrolling row. `ArtworkHero` owns the one existing
artwork image, scrim, avatar, identity and section tabs. Profile viewer state
and its close callback are owned by `MemberProfileScreen`.

## Goals / Non-Goals

**Goals:**

- Keep Back visible on the left and make “Send a message” the primary action
  on another member's profile.
- Put experience sharing and contact actions in an accessible overflow menu.
- Keep self editing and existing contact action states and confirmation.
- Continue the same artwork behind the action area and system top insets while
  retaining a single artwork composable and the shared tab row.
- Preserve the action/header/tab/pager structure and compact viewport targets:
  at least 96 dp of section content at a 360 dp viewport with 24 dp top and
  80 dp bottom insets, and 48 dp at a 320 dp viewport with those insets.
- Preserve the avatar's 48 dp minimum hit target and photo-viewer state,
  callbacks, lazy loading and return-to-section behaviour.

**Non-Goals:**

- Changing profile routes, API calls, contact semantics or confirmation copy.
- Changing profile sections, pager ownership, photo viewer behaviour or iOS.
- Introducing a second artwork image or independent header artwork state.

## Decisions

### One continuous artwork header

Extend the existing `ArtworkHero` drawing/layout behind the top action area,
including the status-bar inset, and render the action controls over its scrim.
The existing hero remains the sole owner of artwork, identity, avatar and
bottom tabs. The implementation should derive the combined header height from
the measured action row, system insets, hero content and tab bar, then apply
the existing compact-header budget to the combined frame. Avoid sizing the
hero as though the action row were still a separate stacked surface. The pager
continues to contain only scrollable section content.

### Primary action and overflow

Keep Back as a labelled control at the left edge. For another member, always
show the primary message action at the right edge across supported phone
widths, using a compact but readable treatment. Place experience sharing and the existing
contact action in a Material overflow menu with an accessible menu label and
48 dp action targets. For the signed-in member, expose profile editing in the
action area and omit actions that apply only to another member. Preserve
relationship loading, add-contact routing, pending-request deletion and
confirmed-contact removal confirmation exactly as they work now.

### Insets and constrained heights

Account for the top system inset once in the artwork-backed header and the
bottom inset once in the available profile height. Preserve the 360 dp and
320 dp content targets after those insets. Keep controls legible over the
artwork in both system appearances and preserve the existing 48 dp avatar hit
target. Any new action, menu, or accessibility text is defined in Android
string resources; user-visible wording uses British spelling.

## Risks / Trade-offs

- Overlaying actions on artwork needs a scrim that keeps icon and text contrast
  readable for arbitrary profile images and for the fallback background.
- The smaller viewport leaves limited room for Back, the message action and
  overflow. The layout must keep each target usable and retain the specified
  section-content minimums.
- Insets may already be included in the host's `contentPadding`; implementation
  must avoid applying the top or bottom inset twice.

## Migration Plan

No data migration or server deployment is needed. Ship as an Android UI update.
