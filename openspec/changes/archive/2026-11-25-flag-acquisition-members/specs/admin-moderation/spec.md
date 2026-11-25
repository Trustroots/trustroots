## ADDED Requirements

### Requirement: Greeter flags on acquisition stories

Greeters SHALL be able to add the existing internal follow-up flag to another member from their acquisition-story row. The action SHALL be idempotent and audited, and flagged members SHALL appear in Support's flagged-member list. The endpoint SHALL require the greeter role and an existing acquisition story for the target. Only Support staff and administrators SHALL be able to remove the flag or browse the flagged-member list.

#### Scenario: Greeter flags a suspicious account

- **WHEN** a greeter flags a member from Acquisition stories
- **THEN** the row shows that the member is flagged, including after a reload
- **AND** Support can find that member in its flagged-member list
- **AND** other account roles and profile visibility remain unchanged

#### Scenario: Member cannot flag via Acquisition stories

- **WHEN** a regular member attempts to use the acquisition-story flag endpoint
- **THEN** access is denied

## MODIFIED Requirements

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

- **WHEN** a visitor, regular member, greeter or flagged member requests flag management through the Support API or requests the flagged-member list
- **THEN** access is denied

#### Scenario: Flagged member uses the site

- **WHEN** a flagged member signs in, views profiles or sends messages
- **THEN** existing account permissions and visibility still apply
- **AND** their flag is not included in member-facing profile or bootstrap data
