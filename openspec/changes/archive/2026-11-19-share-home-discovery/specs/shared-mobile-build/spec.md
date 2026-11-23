## ADDED Requirements

### Requirement: Shared dashboard shows homepage discovery

The shared dashboard SHALL show the public featured Nostr feed and use the same connection discovery rules as the signed-in website. It SHALL preserve access to profile and messages when discovery is unavailable.

#### Scenario: Dashboard has discovery data

- **WHEN** featured notes and eligible connection data are available
- **THEN** Home shows the featured notes and recently active connections in server order
- **AND** the map distinguishes approximate hosting and meeting locations
- **AND** the dashboard omits the Nostroots introduction

#### Scenario: Discovery is unavailable

- **WHEN** either discovery request fails
- **THEN** the other section and core navigation remain independently usable
