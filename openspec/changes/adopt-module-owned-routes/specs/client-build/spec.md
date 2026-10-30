## ADDED Requirements

### Requirement: Production client is an ES module entry with hashed chunks

The production client build SHALL emit an ES module entry with the stable name `react-main.js` and split lazily loaded code into content-hashed chunk files. The server layout SHALL load the entry as a module script carrying the page's CSP nonce, and SHALL keep its commit-based cache-busting query on the entry URL. The build SHALL emit one stylesheet.

#### Scenario: Production page loads

- **WHEN** a browser loads a page from a production build
- **THEN** the layout loads `react-main.js` as a module script with the page nonce
- **AND** lazily loaded routes fetch their hashed chunks from the same origin

### Requirement: Deploys keep open tabs working

A deploy SHALL publish the entry and its chunks together. When an open tab from a previous build fails to load a chunk, the client SHALL reload the page once to pick up the new build, and SHALL NOT reload again for the same build if the retry also fails.

#### Scenario: Tab from the previous build navigates after a deploy

- **WHEN** a tab loaded before a deploy navigates to a route whose chunk no longer exists
- **THEN** the page reloads once and renders the route from the new build

#### Scenario: Chunk keeps failing after the reload

- **WHEN** the chunk still fails to load after that reload
- **THEN** the client does not reload again
