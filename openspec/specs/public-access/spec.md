# Public Access Specification

## Purpose

Allow visitors to discover Trustroots, read public information, and begin using
the service without an existing account.

## Requirements

### Requirement: Homepage access

The system SHALL make the Trustroots homepage available without authentication
and present entry points for signing in and creating an account.

#### Scenario: Visitor opens the homepage

- **WHEN** a visitor opens the homepage
- **THEN** the Trustroots homepage is displayed
- **AND** sign-in and sign-up entry points are available

### Requirement: Public information and circles

The system SHALL make its public information pages and circle catalogue
available without authentication.

#### Scenario: Visitor browses circles

- **WHEN** a visitor opens the circles page
- **THEN** a list of available circles is displayed

#### Scenario: Visitor opens a public information page

- **WHEN** a visitor opens a supported public information page
- **THEN** the requested page is displayed without requiring authentication

### Requirement: Unknown-route response

The system SHALL show a user-facing not-found page when a visitor requests an
unknown browser route.

#### Scenario: Visitor opens an unknown route

- **WHEN** a visitor opens a route that is not provided by the application
- **THEN** the visitor is shown the not-found page

### Requirement: Public support requests

The system SHALL let a visitor submit a valid support request and explain when
the request cannot be accepted or sent.

#### Scenario: Visitor submits a valid support request

- **WHEN** a visitor submits a valid support request
- **THEN** the system accepts the request for delivery

#### Scenario: Support request cannot be delivered

- **WHEN** a support request has invalid data or cannot be sent
- **THEN** the system displays validation or delivery feedback

### Requirement: Public service information

The system SHALL make public language data, site statistics, and service-worker
configuration available to visitors.

#### Scenario: Visitor requests public service data

- **WHEN** a visitor requests supported public language, statistics, or service-worker data
- **THEN** the system returns the corresponding public response

### Requirement: Legacy public routes

The system SHALL redirect supported legacy invitation, tribe, and about routes
to their current public destinations.

#### Scenario: Visitor opens a supported legacy public route

- **WHEN** a visitor opens a supported legacy invitation, tribe, or about route
- **THEN** the system redirects the visitor to the current destination

### Requirement: Public statistics presentation

The system SHALL show visitors aggregate Experience and message-interaction
statistics on the statistics page. The page SHALL present one wider card for
real-life connections and recommendation rates and another for replied message
threads and positive feedback rates, with all-time and preceding-90-day
figures.
The public statistics response SHALL be cached for one hour, and failed
responses SHALL NOT replace a successful cached response.

#### Scenario: Visitor views the statistics page

- **WHEN** a visitor opens the statistics page
- **THEN** the page displays all-time and preceding-90-day real-life-connection counts and recommendation rates in one summary
- **AND** displays all-time and preceding-90-day replied-message-thread counts and positive feedback rates in another summary
- **AND** the page does not require authentication

#### Scenario: Repeated visitor requests statistics

- **WHEN** visitors request public statistics more than once within one hour
- **THEN** the system reuses the successful aggregate response
- **AND** advertises the same lifetime to shared HTTP caches
