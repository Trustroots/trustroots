## ADDED Requirements

### Requirement: Trustroots Nostr service identity

The webapp SHALL resolve the service signing key from `TRUSTROOTS_NOSTR_SERVICE_NSEC` with a fallback to `TRUSTROOTS_NOSTR_EXPORT_NSEC` when the preferred variable is unset. The NIP-05 lookup for `_` SHALL expose only the configured public key, without a member record.

#### Scenario: A client resolves the domain identity

- **WHEN** a client looks up `_` and a valid service signing key is configured
- **THEN** the response maps `_` to the lower-case hexadecimal public key

#### Scenario: An administrator publishes the service profile

- **WHEN** an administrator requests publication on the Nostr admin page
- **THEN** the server signs a kind 0 profile declaring `_@trustroots.org` and submits it to the Trustroots public relay
- **AND** the administrator receives the publication result
