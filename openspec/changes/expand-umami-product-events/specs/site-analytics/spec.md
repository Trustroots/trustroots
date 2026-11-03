## ADDED Requirements

### Requirement: Product event coverage

The event catalogue SHALL cover the member funnels: signup steps and outcome, email confirmation, sign-in and password reset, profile completion, offers, search filters and searches with no results, reaching out to another member (first messages and contact requests with where they started, and the message gate), circle membership, support requests by category, language switching and navigation. Every event SHALL answer a question listed in `docs/analytics.md`, and events whose answer the database or page views already hold SHALL NOT be added. Event names SHALL be snake_case and SHALL be listed, with their data and when they fire, in `docs/analytics.md`. Event data SHALL be limited to values from fixed lists, small counts and HTTP statuses.

#### Scenario: Member sends a first message after finding a host in search

- **WHEN** a member opens a host's profile from a search result and sends them a first message
- **THEN** the client sends `message_sent` with `kind` `first` and `source` `search`, and no username, id, text or location

#### Scenario: Member's profile is too short to write

- **WHEN** a member opens an empty thread while their profile is shorter than the minimum length
- **THEN** the client sends `message_gate_shown` with `reason` `profile_too_short`

### Requirement: Failure reasons

Every feature `*_failed` event SHALL carry a `reason` from a fixed list, chosen from the HTTP status of the failed request alone, never from the server's message: `signin_failed` `credentials`, `suspended`, `rate_limited` or `server`; `email_confirm_failed` `invalid_link` or `server`; `password_reset_failed` `invalid_link`, `rate_limited` or `server`; `message_send_failed` `rate_limited` or `other`; `profile_save_failed` and `offer_save_failed` `validation` or `server`. Statuses the server uses for more than one cause SHALL map to one value.

#### Scenario: Sign-in with a wrong password

- **WHEN** a visitor signs in with a wrong password and the server answers 400
- **THEN** the client sends `signin_failed` with `reason` `credentials` and nothing from the response message

#### Scenario: Member hits the message rate limit

- **WHEN** sending a message answers 429
- **THEN** the client sends `message_send_failed` with `reason` `rate_limited`

### Requirement: Error events

The app shell SHALL report failed API requests with only the HTTP status, the request method and the first path segment after `/api/`, and SHALL report uncaught errors and unhandled promise rejections with only their kind. Requests without a response, such as cancelled or offline requests, and statuses the request lists as expected SHALL NOT be reported.

#### Scenario: An API request fails

- **WHEN** a request to `/api/users/<username>` fails with status 500
- **THEN** the client sends `api_request_failed` with status 500, the method and area `users`, and nothing from the rest of the URL

#### Scenario: A request answers as designed

- **WHEN** a request to `/api/contact-by/<id>` answers 404 because the two members are not contacts
- **THEN** the client sends no `api_request_failed`

### Requirement: Web Vitals collection

The Umami script tag SHALL enable the tracker's Web Vitals collection, so that the analytics Performance view receives page performance measurements under the same Do-Not-Track and opt-out rules as page views.

#### Scenario: Browser loads a page with analytics enabled

- **WHEN** the application renders a page with Umami analytics enabled
- **THEN** the Umami script tag carries `data-performance="true"`
