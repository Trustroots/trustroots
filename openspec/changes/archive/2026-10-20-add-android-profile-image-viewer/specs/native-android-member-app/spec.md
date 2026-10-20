## ADDED Requirements

### Requirement: Full-screen profile photo viewer

The Android app SHALL let a member open a profile photo in a native, black,
full-screen viewer. Only after opening, the viewer SHALL lazily request the
largest existing avatar rendition (2048 pixels) through the existing
session-aware artwork transport and cache, accepting renditions up to the
server's existing 8 MiB avatar limit. It SHALL preserve the decoded
image's aspect ratio without cropping. Its initial scale SHALL be the smaller
of the scales needed to fit the decoded bitmap within the usable viewer bounds
and `1.0`; therefore, small images are never enlarged. Pinch zoom SHALL range
from this initial scale up to `1.0` decoded source image pixel per physical
display pixel, calculated with display density accounted for. Panning SHALL
remain within the image bounds, and returning to the minimum zoom SHALL restore
the initial fit and centred position.

The viewer SHALL account for system bars and display cut-outs, use a black
background with white status and navigation bar icons in both light and dark
system appearances, and restore the prior window appearance when closed. It
SHALL expose an accessible image description and accessible zoom/reset
actions, and provide a close control with at least a 48dp touch target. System Back and the close
control SHALL close the viewer and return to the same profile and profile
section. Image loading and decoding SHALL not block navigation or invalidate
the member session.

#### Scenario: Member opens a profile photo

- **WHEN** a member activates the profile photo
- **THEN** the viewer requests the 2048-pixel avatar rendition only after it is
  opened, using the current profile session
- **AND** the whole image is centred on black and initially fitted within the
  usable bounds without upscaling based on the decoded bitmap's actual pixel
  dimensions

#### Scenario: Member zooms into a profile photo

- **WHEN** a member pinches to zoom or uses an accessible zoom action
- **THEN** the image can be enlarged up to one decoded source pixel per physical
  display pixel
- **AND** panning cannot reveal empty space beyond the image
- **AND** returning to minimum zoom restores the initial fit

#### Scenario: Member closes the viewer

- **WHEN** a member activates the close control or Android system Back
- **THEN** the viewer closes
- **AND** the same profile and selected profile section are visible

#### Scenario: Profile photo is loading or unavailable

- **WHEN** the photo request is pending, fails, or cannot reach the server
- **THEN** the viewer keeps an accessible close control available
- **AND** presents a non-blocking loading or error state
- **AND** the member can continue using the app without being signed out
- **AND** previously cached imagery MAY be shown when available, but persistent
  offline image availability is not promised
