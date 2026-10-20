## 1. Profile image viewer

- [x] 1.1 Add a full-screen profile photo viewer entered from the profile image
      and lazily request the existing 2048-pixel avatar rendition only when
      opened, using the active profile session and existing artwork transport
      and cache.
- [x] 1.2 Fit the complete image within the viewer's usable bounds with an
      initial scale of `min(viewportWidth / imageWidth, viewportHeight /
    imageHeight, 1)`. Use physical pixel dimensions for this calculation so
      the image is never enlarged on first display.
- [x] 1.3 Support pinch zoom and panning from the initial fit through a maximum
      scale of one source image pixel per physical display pixel. Use the
      decoded bitmap's actual width and height, not the requested rendition
      size, as the source dimensions. Clamp pan so no empty area is exposed
      beyond the image; reset to the initial fit when zoom returns to minimum.
- [x] 1.4 Provide a black full-screen surface, accessible image description,
      at-least-48dp close control, accessible zoom/reset actions, system bar and
      cut-out handling, and predictable system Back and close behaviour that
      returns to the same profile section.
- [x] 1.5 Keep loading and image errors local to the viewer, retain the close
      affordance in loading/error states, and avoid treating image request
      failure as a session failure. Reuse an already available bitmap when it
      matches the requested rendition; do not promise persistent offline
      availability.

## 2. Validation

- [x] 2.1 Add anonymous Compose device coverage for no-upscale initial fit,
      downscaled initial fit, pinch zoom ceiling, pan bounds, loading/error
      states, accessible actions, insets, and both close paths restoring profile
      section state.
- [x] 2.2 Validate this OpenSpec change and run the relevant Android lint and
      device tests.
