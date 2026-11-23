## ADDED Requirements

### Requirement: Hitchwiki and Hitchwiki Maps profile links

Members SHALL be able to save or clear separate optional Hitchwiki and Hitchwiki Maps usernames in the web profile network editor. The profile and Test links SHALL use `https://hitchwiki.org/en/User:<username>` for Hitchwiki and `https://maps.hitchwiki.org/account/<username>` for Hitchwiki Maps, encoding each username and opening the link in a new tab. Both usernames SHALL follow the existing visibility rules for external contact details.

#### Scenario: Save or clear a Hitchwiki username

- **WHEN** a member saves a Hitchwiki or Hitchwiki Maps username
- **THEN** the editor and eligible profile viewers can open the corresponding page in a new tab
- **AND** clearing one username removes its profile link independently of the other

#### Scenario: Restrict other-network visibility

- **WHEN** a viewer cannot see a member’s external contact details
- **THEN** the profile response omits the Hitchwiki and Hitchwiki Maps usernames
