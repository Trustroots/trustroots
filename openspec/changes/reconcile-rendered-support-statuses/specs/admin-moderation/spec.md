## ADDED Requirements

### Requirement: Historical support email rendering compatibility

Historical status imports SHALL recognise the original request fingerprint and
the deterministic HTML escaping and URL expansion used by support email
renderers. Matching SHALL retain the original stored category and email identity,
without fuzzy text matching or current username lookups. Across every recognised
rendering, each eligible ticket SHALL match exactly one local request and each
eligible request SHALL match exactly one source ticket.

#### Scenario: A historical email escaped or expanded the original message

- **WHEN** a manifest fingerprint matches a unique request through a documented email-rendering transformation
- **THEN** an administrator can preview and apply its historical status using the existing reduced manifest
- **AND** subsequent imports recognise the same status and Zendesk ticket as already applied.

#### Scenario: Rendering introduces a collision

- **WHEN** rendering makes several requests match one ticket, or several source tickets match one request
- **THEN** the preview reports the ambiguity and applies none of those ambiguous matches.

#### Scenario: A rendered match changes after preview

- **WHEN** the original stored identity, message, status or activity changes after preview
- **THEN** apply skips the request even if its newly rendered text would still match
- **AND** imports send no correspondence and retain existing audit privacy rules.

### Requirement: Separate support member search

Administrators and support-team members SHALL access member search from a
dedicated admin sidebar item at `/admin/support/members`. The support inbox SHALL
not include the member search form. Selected requests SHALL show their original
sender username linked to `/admin/user/{username}` beside the submission timestamp,
with a plain visitor fallback when no username is present. Links SHALL NOT grant
additional permissions or establish ownership of a historical request.

#### Scenario: A support member searches from the sidebar

- **WHEN** an administrator or support-team member chooses Member search
- **THEN** the dedicated page offers the existing name, username or email search
- **AND** Member search is the active sidebar item while Support inbox is not.

#### Scenario: An inbox request is selected

- **WHEN** staff select a request in the support inbox
- **THEN** the member search form is absent and the original sender and submission time appear together
- **AND** following a username link retains the destination's existing permissions.
