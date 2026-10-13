## Why

The message editor stops growing at 250px on desktop and 100px on mobile, forcing members to scroll through moderately long drafts. Members need to drag the writing area to their preferred height.

## What Changes

- Add a draggable handle above the opening-message and reply editor, with mouse, touch and keyboard support.
- Let members drag upwards to enlarge the composer and downwards to shrink it, within the available conversation area.
- Preserve drafts and preview state during resizing, keep Send visible and reset the size after sending successfully.

## Impact

- Messaging composer, styles, English translation keys and regression coverage.
- No API or database changes.
