## ADDED Requirements

### Requirement: Hospitality exchange experience at signup

The signup form SHALL ask separately about experience hosting people and staying with people the new member has not met before. Both questions SHALL be optional and offer “No experience yet”, “Once”, “A few times”, and “Many times”. The signup API SHALL store supplied answers independently with the new account and SHALL exclude them from signup responses and member profiles.

#### Scenario: New member gives different answers for hosting and staying

- **WHEN** a new member selects “No experience yet” for hosting and “A few times” for staying
- **THEN** signup succeeds and the two selected answers are stored privately

#### Scenario: Signup leaves a question unanswered

- **WHEN** a signup submission omits either or both answers
- **THEN** signup can proceed and each unanswered question stays unset

#### Scenario: Signup submits an unsupported answer

- **WHEN** a signup request supplies an unsupported experience answer for either question
- **THEN** the API rejects the request with HTTP 400 before creating an account
