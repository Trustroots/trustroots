## ADDED Requirements

### Requirement: Circle hashtags in profile descriptions

The web profile's About me section SHALL display a hashtag as a link to
`/circles/{slug}` when its text matches a circle slug in the viewer's circle
directory. Matching SHALL be case-insensitive and support hyphenated slugs.
Unmatched hashtags SHALL remain text, and the existing restrictions on
embedded link destinations SHALL still apply.

#### Scenario: Multiple circles mentioned in a profile description

- **WHEN** a profile description contains `#hackers #hitchhikers and #musicians very welcome.` and all three slugs are visible to the viewer
- **THEN** each of the three hashtags links to its corresponding circle page
- **AND** the surrounding description retains its text and formatting

#### Scenario: Unknown circle hashtag

- **WHEN** a profile description contains a hashtag whose slug is absent from the viewer's circle directory
- **THEN** the hashtag is displayed as plain text

#### Scenario: Long profile description

- **WHEN** a profile description is truncated in the preview
- **THEN** complete matching hashtags in the preview are links
- **AND** expanding the description shows links for all matching hashtags
