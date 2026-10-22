# Improve circle editor navigation and descriptions

## Why

The selected circle cannot be bookmarked in the editor, and administrators need
direct navigation between a circle and its editor. Description links and a live
preview help administrators check the content they publish.

## What Changes

- Select circles at `/admin/circles/{slug}`, including direct loads and history.
- Link the editor to the public circle and show its edit link to administrators.
- Preserve safe description links and preview description formatting while editing.

## Impact

Circle editor routing, description rendering, and their regression tests.
