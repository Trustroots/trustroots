## ADDED Requirements

### Requirement: Volunteering hosting option

Members SHALL be able to mark their hosting offer as welcoming volunteering help.
The option SHALL be off by default, and missing values on existing offers SHALL
mean false. Arrangements SHALL remain in the existing description, sharing the
offer's location, availability and visibility rules.

#### Scenario: Host saves the volunteering option

- **WHEN** a host enables the volunteering option and saves their offer
- **THEN** the option remains enabled when they reopen the editor
- **AND** the offer displays a volunteering label with its existing description

#### Scenario: Existing offer has no volunteering setting

- **WHEN** an existing hosting offer has no volunteering setting
- **THEN** it behaves as an ordinary hosting offer with the option disabled

#### Scenario: Update omits the volunteering setting

- **WHEN** an offer update omits the volunteering setting
- **THEN** the saved setting is preserved

### Requirement: Discover volunteering hosts

Members SHALL be able to filter map search to hosting offers with the
volunteering option enabled. Existing search and visibility restrictions SHALL
continue to apply. Disabling this filter SHALL restore ordinary search behaviour.

#### Scenario: Search for volunteering hosts

- **WHEN** a member enables the volunteering filter
- **THEN** only otherwise eligible hosting offers with volunteering enabled appear
- **AND** the filter selection persists through the existing search filter storage

#### Scenario: Host turns off volunteering

- **WHEN** a host disables the volunteering option
- **THEN** the offer no longer matches the volunteering filter
- **AND** it remains eligible for ordinary hosting search
