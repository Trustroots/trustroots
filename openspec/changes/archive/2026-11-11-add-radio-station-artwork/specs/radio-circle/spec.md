## ADDED Requirements

### Requirement: Official station artwork in catalogue rows

Radio station rows SHALL show official station artwork when it is available in
the curated station catalogue metadata. Artwork URLs in that metadata SHALL use
HTTPS and come from official broadcaster or station sources. The artwork
SHALL link to the broadcaster's website separately from the play control.
Station rows SHALL show initials derived from
the station title when artwork metadata is absent or the image fails to load.
This SHALL apply to station rows shown in catalogue groups and favourites.
Artwork SHALL NOT change station identifiers, stream URLs, or playback
behaviour.

#### Scenario: A station has curated official artwork

- **WHEN** a station row has an HTTPS artwork URL in the curated catalogue
- **THEN** the row displays that station artwork as a link to the broadcaster's
  website

#### Scenario: Artwork is absent or fails to load

- **WHEN** a station has no artwork URL or its artwork image fails to load
- **THEN** the row displays initials derived from the station title
- **AND** the station remains available for playback and favouriting

#### Scenario: A station appears in favourites

- **WHEN** a station with artwork or a fallback appears in the favourites list
- **THEN** its row uses the same artwork and fallback behaviour as catalogue
  rows
