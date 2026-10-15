## MODIFIED Requirements

### Requirement: Production client build uses Vite

The production build command SHALL emit `react-main.js`, `react-main.css`, and
`react-main.rtl.css` with Vite at the paths Express serves. Vite SHALL be the
only supported client build tool in development, production, and end-to-end
CI; Webpack fallback commands SHALL NOT be provided.

#### Scenario: Production build

- **WHEN** the production build command runs
- **THEN** Vite emits the client JavaScript and both stylesheets under `public/assets`
- **AND** unrelated generated files outside that asset build are left in place

#### Scenario: Development and browser tests

- **WHEN** a developer starts the application or CI builds browser test assets
- **THEN** development uses the Vite server and browser tests use the Vite production assets
- **AND** Windows browser tests use the same client build as other end-to-end jobs
