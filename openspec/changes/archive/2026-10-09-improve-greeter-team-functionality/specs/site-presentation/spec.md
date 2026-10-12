## ADDED Requirements

### Requirement: Public greeter team page

The public `/team/greeters` page SHALL explain how greeters welcome new members, show the current eligible roster, and link Want to join to `/support?category=volunteering`. The existing team page SHALL link to it. The roster SHALL provide loading, empty and failure states and placeholder avatars to signed-out visitors.

#### Scenario: Visitor opens the greeter page directly

- **WHEN** a visitor navigates to `/team/greeters`
- **THEN** the page renders without requiring authentication and includes the volunteering enquiry link

### Requirement: Minimal public greeter roster

`GET /api/greeters` SHALL return `{ greeters: [{ _id, username, displayName }] }` containing only public `welcome-team` accounts without suspended or shadowban roles. Results SHALL be sorted by display name and username and limited to 500. No private account fields SHALL be returned.

#### Scenario: Restricted greeter accounts exist

- **WHEN** a roster is requested
- **THEN** hidden, suspended and shadowbanned greeters are omitted
