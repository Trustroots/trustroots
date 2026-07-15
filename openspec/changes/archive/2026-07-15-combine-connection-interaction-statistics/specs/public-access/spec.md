## MODIFIED Requirements

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
