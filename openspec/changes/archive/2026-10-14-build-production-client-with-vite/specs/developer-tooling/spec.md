## ADDED Requirements

### Requirement: Production client build uses Vite

The production build command SHALL emit `react-main.js`, `react-main.css`, and
`react-main.rtl.css` with Vite at the paths Express serves. A Webpack
production build command SHALL remain available.

#### Scenario: Production build

- **WHEN** the production build command runs
- **THEN** Vite emits the client JavaScript and both stylesheets under `public/assets`
- **AND** unrelated generated files outside that asset build are left in place

#### Scenario: Webpack production fallback

- **WHEN** the Webpack production build command runs
- **THEN** it emits the same entry filenames with Webpack
