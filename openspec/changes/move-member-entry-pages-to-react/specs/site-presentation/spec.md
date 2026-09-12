## ADDED Requirements

### Requirement: React member entry pages

The system SHALL render welcome, navigation and member search using the
existing React application shell while preserving their member-only access
and links into other application workflows.

#### Scenario: Member opens an entry page

- **WHEN** a signed-in member opens `/welcome`, `/navigation` or `/search/members`
- **THEN** the page uses the React root and assets
- **AND** its existing content, title and footer visibility are preserved

#### Scenario: Guest opens an entry page

- **WHEN** a guest opens one of the member entry pages
- **THEN** the guest is redirected to sign in

#### Scenario: Member searches from a link

- **WHEN** a member opens `/search/members?search=sample`
- **THEN** the search field and results use the supplied query
- **AND** result links open the existing profile workflow

#### Scenario: Member leaves an entry page

- **WHEN** a member follows a link to an Angular-owned workflow
- **THEN** the destination loads its application root
- **AND** signing out from navigation ends the authenticated session
