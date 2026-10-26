### Requirement: Native profile activity and readable language names

The Android member profile SHALL display the public profile's last-seen time
using a localised relative label. If the timestamp is missing, the profile
SHALL display a clear long-ago fallback. If the timestamp is malformed, the
profile SHALL display an unavailable status. Recognised ISO-prefixed
language identifiers SHALL be shown using their language name, including
Mandinka for `iso_639_3-mnk`. These details SHALL preserve the existing
biography, hosting and circles order.

#### Scenario: Member views a profile with a last-seen timestamp

- **WHEN** a member opens a profile with a valid public `seen` timestamp
- **THEN** Android displays a localised relative last-seen label
- **AND** biography, hosting and circles remain in their current order

#### Scenario: Member views a profile without a last-seen timestamp

- **WHEN** the profile has no `seen` timestamp or its value is invalid
- **THEN** Android displays the long-ago fallback

#### Scenario: Member views a profile with a malformed last-seen timestamp

- **WHEN** the profile's `seen` value is not a valid timestamp
- **THEN** Android displays an unavailable status instead of claiming the
  member was last seen a long time ago

#### Scenario: Profile language uses an ISO-prefixed identifier

- **WHEN** a profile lists `iso_639_3-mnk`
- **THEN** Android displays “Mandinka” instead of the raw identifier
