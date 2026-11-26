## ADDED Requirements

### Requirement: iOS offer map uses shared status and legend

The regular iOS app SHALL show its map loading indicator, offer result count,
applicable legend and search errors in shared Compose. The marker legend SHALL
use the same colours as the native annotations and reflow within the viewport.
The overlay SHALL leave map gestures available.

#### Scenario: Show the applicable markers

- **GIVEN** the iOS map has loaded offers
- **WHEN** a member restricts the map to their connections
- **THEN** the shared overlay shows the updated count and omits the Community Notes marker
