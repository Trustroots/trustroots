## ADDED Requirements

### Requirement: React circle pages

The system SHALL render the circle catalogue and individual circle pages with
the existing React application shell, preserving circle access and membership
behaviour on the current supported runtime.

#### Scenario: Visitor opens circle pages

- **WHEN** a visitor opens `/circles` or an available public circle detail
- **THEN** the server selects the React root and assets
- **AND** the page displays the circle catalogue or requested circle

#### Scenario: Visitor opens a member-only circle

- **WHEN** a signed-out visitor opens a member-only circle
- **THEN** the page redirects to sign in without rendering that circle's details
- **AND** the detail API continues to require authentication

#### Scenario: Member changes a membership

- **WHEN** a member joins or leaves a circle through either circle page
- **THEN** membership state and the circle count update
- **AND** the member's current application permissions are retained

#### Scenario: Member follows a circle link into another workflow

- **WHEN** a member opens a profile, search or registration link from a circle
- **THEN** the destination loads through its existing application root

#### Scenario: A circle description contains unsupported markup

- **WHEN** a circle description is displayed
- **THEN** supported text formatting and links are preserved
- **AND** unsupported markup is omitted
