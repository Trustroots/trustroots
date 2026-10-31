## ADDED Requirements

### Requirement: Route access is checked before render

The client SHALL evaluate a route's access policy before the route renders, on the first load and on client navigation. A visitor who must sign in SHALL be redirected to `/signin?continue=true&returnTo=` followed by the encoded path, query string and fragment they asked for. A signed-in member without a required role SHALL be redirected to `/volunteering`. Access redirects SHALL replace the current history entry.

#### Scenario: Signed-out visitor follows a link to a protected route

- **WHEN** a signed-out visitor navigates on the client to a route that requires sign-in
- **THEN** the router redirects to the sign-in page with a return path before the protected page renders

#### Scenario: Member without the required role opens a staff route

- **WHEN** a signed-in member without any of the route's required roles navigates to it
- **THEN** the router redirects to `/volunteering` before the page renders

### Requirement: Parameter-dependent and fixed redirects are checked before render

A route whose sign-in requirement depends on a parameter SHALL require sign-in only for the listed parameter values. A route with a fixed redirect SHALL redirect to its target before rendering.

#### Scenario: Visitor opens a parameter-dependent route

- **WHEN** a signed-out visitor opens a circle page whose slug requires sign-in
- **THEN** the router redirects to sign in
- **AND** circle pages whose slugs are not listed render without sign-in

#### Scenario: Visitor opens a retired path

- **WHEN** a visitor opens a route that has a fixed redirect
- **THEN** the router redirects to its target before rendering

### Requirement: Route parameters, search and links are typed

Feature modules SHALL declare routes with typed path parameters and typed search. Search validation SHALL keep the router's flat, string-valued query strings: declared keys SHALL be validated without coercion, a declared value that fails validation SHALL be dropped rather than raising an error, and undeclared keys SHALL pass through unchanged. Typed links SHALL be checked against the registered routes at compile time.

#### Scenario: Unknown query parameters survive validation

- **WHEN** a URL carries query parameters a route does not declare
- **THEN** the validated search keeps them unchanged
- **AND** serialising the validated search gives the original query string

#### Scenario: Link to an unknown route

- **WHEN** code links to a path that no registered route declares
- **THEN** the typecheck fails

### Requirement: Server and client share one route manifest

The server and the client SHALL decide route ownership and access from one manifest that feature modules contribute to. The server SHALL serve the client page and apply access redirects for exactly the paths in that manifest, and the internal link checker SHALL validate links against it.

#### Scenario: Module contributes a route policy

- **WHEN** a feature module adds a route policy to its manifest
- **THEN** the server serves that path, the client guards it, and the link checker accepts links to it

### Requirement: URLs stay unchanged

Adopting module-owned routes SHALL NOT change any route path, query string format or redirect target.

#### Scenario: Existing bookmark is opened

- **WHEN** a visitor opens a URL that worked before the change, including its query string
- **THEN** the same page renders with the same parameters
