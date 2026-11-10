## MODIFIED Requirements

### Requirement: Support team access

The `support-team` role SHALL grant current greeter tools, allowlisted member search and details including restricted profiles and account status, internal member notes and internal follow-up flag management. Only administrators SHALL grant or remove this role. It SHALL NOT confer suspension, shadowbanning, general role management, exports, audit browsing or unrestricted private-conversation access.

#### Scenario: Support volunteer investigates an account

- **WHEN** a support volunteer searches for a suspended member
- **THEN** safe account details and status are available without authentication tokens or IP history
- **AND** suspension, shadowban and staff role changes remain denied

#### Scenario: Support team member opens a hidden profile

- **WHEN** a Support team member opens the profile from the Support member page for a hidden account
- **THEN** the profile view displays the available member profile content
- **AND** the full administrator report and its API remain restricted to administrators

#### Scenario: Support team member follows a username report link

- **WHEN** a Support team member opens `/admin/user/:username`
- **THEN** the route displays the allowlisted Support member view
- **AND** an administrator at the same URL sees the full administrator report
