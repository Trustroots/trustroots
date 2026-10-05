## ADDED Requirements
### Requirement: Discover members through indexed public profile fields
Authenticated members SHALL be able to reach member search from map search and search names, usernames, home locations, origins and short taglines using a weighted text index. Queries SHALL have bounded length, result count, pagination and execution time. Existing profile visibility and mutual blocking rules SHALL apply.
#### Scenario: Find a member by home location
- **WHEN** an authenticated member submits a home-location query of at least three characters
- **THEN** eligible matching members are returned in relevance order with a bounded result count
- **AND** cards display public location and profile context and identify literal matching fields
#### Scenario: Reach member search from the map
- **WHEN** a member follows the visible member-search link from map search
- **THEN** the member-search page opens with its search input focused
#### Scenario: Reject excessive search input
- **WHEN** a query exceeds the supported length or is not a scalar string
- **THEN** the request is rejected before a database search
