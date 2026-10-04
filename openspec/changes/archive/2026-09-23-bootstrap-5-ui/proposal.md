## Why

The React client still uses Bootstrap 3 and React Bootstrap 0.33. Its global
styles, navigation, dialogs and tabs depend on APIs that have changed in
Bootstrap 5. The completed Angular cutover allows the client to move to one
current Bootstrap version.

## What Changes

- Use Bootstrap 5 and React Bootstrap 2 in the React client.
- Update the shared navigation and interactive components to their supported
  React Bootstrap APIs.
- Replace Bootstrap 3 Less imports and adapt site styles and markup so existing
  pages retain their layout and interaction across mobile and desktop widths.

## Capabilities

### Modified Capabilities

- `site-presentation`: The shared React shell retains responsive navigation,
  forms, dialogs and page layout with Bootstrap 5 styling.

## Impact

The client dependencies, Webpack CSS entry, shared Less styles and React
components change. No API or database migration is required. Deployment
rebuilds the client assets; rollback uses the previous application image.
