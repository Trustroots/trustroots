## ADDED Requirements

### Requirement: Mobile apps can preview shared Home in the regular member shell

Android and iOS debug builds SHALL offer an explicit launch option that starts signed-in
members at shared Home within the regular app shell. The shell SHALL retain
native Search and Messages tabs and access to Circles via Android Profile or
iOS Menu.
Shared Home SHALL use the host session and open connection profiles using native
navigation.

#### Scenario: Open a connection in the regular app shell

- **GIVEN** a member launches the debug app with shared Home enabled
- **WHEN** they open a connection from the Home dashboard
- **THEN** the regular platform profile screen opens using the existing session
- **AND** dismissing the profile returns to Home with the regular tab bar available
