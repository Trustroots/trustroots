## MODIFIED Requirements

### Requirement: Support team access

The `support-team` role SHALL grant current greeter tools, allowlisted member search and details including restricted profiles and account status, internal member notes and internal follow-up flag management. Only administrators SHALL grant or remove this role. Support volunteers SHALL be able to apply shadowbans and suspensions from the support member page. Support volunteers SHALL be denied moderation of their own account and administrator accounts, and SHALL be denied replacing a suspension with a shadowban. General role management, exports, audit browsing and unrestricted private-conversation access SHALL remain restricted.

#### Scenario: Support volunteer investigates an account

- **WHEN** a support volunteer searches for a suspended member
- **THEN** safe account details and status are available without authentication tokens or IP history
- **AND** staff role changes remain denied

#### Scenario: Support volunteer restricts a member

- **WHEN** a support volunteer confirms a shadowban or suspension for an eligible member
- **THEN** the account status updates and the request is recorded in the audit log

## ADDED Requirements

### Requirement: Audit log moderation filters

The audit log SHALL allow administrators to filter for shadowban and suspension requests, including historical role additions with no explicit action. The filters SHALL combine with username and team filters. The audit log page SHALL hide the signed-in administrator's own actions by default and provide a checkbox to include them. Filtering SHALL occur before limiting the results.

#### Scenario: Administrator reviews support moderation

- **WHEN** an administrator selects Shadowban or Suspend and filters by Support team
- **THEN** the log shows the latest matching requests made by support team members
- **AND** the administrator can uncheck Don’t show my actions to include their own matching requests
