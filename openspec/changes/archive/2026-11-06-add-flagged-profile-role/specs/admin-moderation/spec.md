## ADDED Requirements

### Requirement: Internal profile follow-up flags

The system SHALL support a `flagged` role for profiles requiring moderation follow-up. Administrators and support-team members SHALL be able to add and remove it, see its labelled status in internal profile views and find flagged members through a paginated list. Assigning the role SHALL NOT grant permissions, suspend or ban the member, hide their profile, change their subscriptions or restrict messaging. The flag SHALL NOT be exposed in public/member-facing profile responses or the flagged member’s client bootstrap. Changes SHALL be audited.

#### Scenario: Support flags or unflags a member

- **WHEN** a support-team member or administrator adds or removes the follow-up flag
- **THEN** the change persists and the internal profile status updates
- **AND** other roles and account state remain unchanged
- **AND** the action is audited

#### Scenario: Support finds flagged profiles

- **WHEN** support staff open the flagged-member list
- **THEN** they can page through flagged profiles and open the corresponding support member views
- **AND** unflagged profiles are excluded

#### Scenario: Member attempts to manage flags

- **WHEN** a visitor, regular member, greeter or flagged member requests flag management or listing
- **THEN** access is denied

#### Scenario: Flagged member uses the site

- **WHEN** a flagged member signs in, views profiles or sends messages
- **THEN** existing account permissions and visibility still apply
- **AND** their flag is not included in member-facing profile or bootstrap data

## MODIFIED Requirements

### Requirement: Support team access

The `support-team` role SHALL grant current greeter tools, allowlisted member search and details including restricted profiles and account status, internal member notes and internal follow-up flag management. Only administrators SHALL grant or remove this role. It SHALL NOT confer suspension, shadowbanning, general role management, exports, audit browsing or unrestricted private-conversation access.

#### Scenario: Support volunteer investigates an account

- **WHEN** a support volunteer searches for a suspended member
- **THEN** safe account details and status are available without authentication tokens or IP history
- **AND** suspension, shadowban and staff role changes remain denied
