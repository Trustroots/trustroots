## ADDED Requirements

### Requirement: Independent availability and shared location

Members SHALL be able to update location for every hosting status and independently opt into Happy to meet. Meeting availability SHALL default to false and SHALL share the existing location offer's privacy controls. Dated meetups SHALL retain independent locations and expiry dates.

#### Scenario: Non-host opts in

- **WHEN** a member who cannot host saves a location and enables Happy to meet
- **THEN** the saved hosting status remains unavailable and meeting availability is enabled without a date or duplicate location entry

#### Scenario: Profile shows both states

- **WHEN** an opted-in non-host's profile is viewed
- **THEN** it shows Cannot host currently and Happy to meet

### Requirement: Discovery respects independent availability

Meeting discovery SHALL include opted-in members at their fuzzy location using meeting markers and existing visibility restrictions. Host-only discovery SHALL exclude members who cannot host. The editor SHALL explain how both states affect map visibility.

#### Scenario: Separate filters

- **WHEN** an opted-in non-host is searched for with meeting-only filters
- **THEN** a meeting marker is returned and no result is returned with host-only filters

#### Scenario: Meeting disabled

- **WHEN** a member disables Happy to meet
- **THEN** ongoing meeting discovery stops while independent hosting availability is preserved

#### Scenario: Existing restrictions

- **WHEN** meeting discovery is requested
- **THEN** circle restrictions and non-public, suspended and shadowbanned member exclusions apply and exact coordinates are never returned

#### Scenario: Existing dated meetup

- **WHEN** a dated meetup is created or edited
- **THEN** its existing expiry and independently selected location continue to apply
