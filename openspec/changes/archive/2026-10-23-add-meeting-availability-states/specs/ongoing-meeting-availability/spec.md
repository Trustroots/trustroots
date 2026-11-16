## MODIFIED Requirements

### Requirement: Independent availability and shared location

Members SHALL select Yes, Maybe, No or Not set for meeting availability independently of hosting. The default SHALL be Not set. Both the owner profile and offer editor SHALL use the same labelled radio control. Existing saved locations SHALL support immediate profile updates with visible errors on failure. Members without a saved location SHALL be directed to the location editor. Meetings SHALL share the existing fuzzy location and privacy controls. Dated meetups SHALL retain independent locations and expiry dates.

#### Scenario: Profile states

- **WHEN** a member selects a meeting availability
- **THEN** Yes shows wants to meet people, Maybe shows maybe up for meeting, and No shows too busy to meet people separately from accommodation

#### Scenario: Unanswered preference

- **WHEN** availability is missing or Not set
- **THEN** visitors see no meeting status and the owner sees a prompt to choose

#### Scenario: Direct profile update

- **WHEN** the owner selects a state on a profile with a saved location
- **THEN** the state is saved without changing hosting and remains selected after reload

#### Scenario: Non-host opts in

- **WHEN** a member who cannot host saves a location and selects Yes or Maybe for meeting
- **THEN** hosting remains unavailable and meeting availability is enabled without a date or duplicate location entry

#### Scenario: Profile shows both states

- **WHEN** an opted-in non-host's profile is viewed
- **THEN** it shows Cannot host currently and a separate meeting availability row

### Requirement: Discovery respects independent availability

Meeting discovery SHALL include members choosing Yes or Maybe at their fuzzy location using meeting markers and existing visibility restrictions. No and Not set SHALL exclude ongoing meeting availability. Host-only discovery SHALL exclude members who cannot host. The editor SHALL explain map visibility.

#### Scenario: Tentative availability

- **WHEN** a non-host selects Maybe
- **THEN** meeting search includes the member and their profile/search card describes the tentative availability

#### Scenario: Opt out or reset

- **WHEN** a member selects No or Not set
- **THEN** meeting discovery stops without changing hosting availability

#### Scenario: Existing restrictions

- **WHEN** meeting discovery is requested
- **THEN** circle restrictions and non-public, suspended and shadowbanned member exclusions apply and exact coordinates are never returned

#### Scenario: Separate filters

- **WHEN** an opted-in non-host is searched for with meeting-only filters
- **THEN** a meeting marker is returned and no result is returned with host-only filters

#### Scenario: Meeting disabled

- **WHEN** a member selects No or Not set
- **THEN** ongoing meeting discovery stops while independent hosting availability is preserved

#### Scenario: Existing dated meetup

- **WHEN** a dated meetup is created or edited
- **THEN** its existing expiry and independently selected location continue to apply
