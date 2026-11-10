## ADDED Requirements

### Requirement: Optional profile usernames

The batch author visibility endpoint SHALL return a mapping from eligible
public-key hex values to Trustroots usernames when a signed-in member requests
`profiles=1`. The response SHALL omit usernames for ineligible or unlinked keys
and SHALL omit the mapping for anonymous requests and requests without the option.

#### Scenario: A signed-in member requests profile usernames

- **WHEN** a signed-in member requests profile usernames for a batch of keys
- **THEN** the response includes usernames for eligible public authors only

#### Scenario: A visitor requests profile usernames

- **WHEN** an anonymous visitor requests profile usernames
- **THEN** the response includes only the ordinary author visibility fields
