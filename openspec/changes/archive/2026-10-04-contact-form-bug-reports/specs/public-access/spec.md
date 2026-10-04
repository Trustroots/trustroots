## MODIFIED Requirements

### Requirement: Public support requests

The system SHALL let a visitor or signed-in member submit a valid support
request, select Account help, Report a member, Report a bug, Volunteering, or Other, and
explain when the request cannot be accepted or sent. The category SHALL be
retained with the request and included in the support email body and subject.

#### Scenario: Visitor submits a valid support request

- **WHEN** a visitor submits a valid support request
- **THEN** the system accepts the request for delivery
- **AND** stores and emails its selected category

#### Scenario: Support request cannot be delivered

- **WHEN** a support request has invalid data or cannot be sent
- **THEN** the system displays validation or delivery feedback

#### Scenario: Prospective volunteer expresses interest

- **WHEN** a visitor or signed-in member follows the volunteer button on `/volunteering`
- **THEN** the support form opens with Volunteering selected
- **AND** invites a short description of interests, skills, and availability
- **AND** the Team Guide remains available on the volunteering page

#### Scenario: Existing member-report link is opened

- **WHEN** a visitor or member opens `/support?report=example-member`
- **THEN** Report a member is selected even if another category is specified
- **AND** the reported username is retained in the report submission

#### Scenario: Reporter changes to another category

- **WHEN** a reporter selects a category other than Report a member
- **THEN** the request is submitted without a reported username

#### Scenario: Older client submits an uncategorised request

- **WHEN** an API client omits the category
- **THEN** the request is categorised as Report a member if a reported username exists
- **AND** otherwise it is categorised as Other

#### Scenario: Client submits an unknown category

- **WHEN** an API client submits an unsupported category
- **THEN** the request is rejected before storage or email delivery

#### Scenario: Bug report contact route

- **WHEN** a member selects Report a bug from the menu
- **THEN** the support form opens with Report a bug selected
- **AND** submitting retains reportBug in storage and its readable label in email

#### Scenario: Bug reporting FAQ

- **WHEN** a visitor reads the bugs-and-features FAQ
- **THEN** the FAQ links to the bug-report contact form as the primary route
- **AND** GitHub is optional without issue-search or account-registration instructions
