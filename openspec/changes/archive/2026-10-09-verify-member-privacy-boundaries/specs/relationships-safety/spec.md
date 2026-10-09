## ADDED Requirements

### Requirement: Verify member privacy boundaries

The system SHALL preserve established member privacy policy across profile,
avatar, member search, private messages and data exports. Anonymous, available,
blocked, suspended or shadowbanned, and administrator viewers SHALL be covered
by anonymous regression fixtures and a cross-surface matrix. The checks SHALL
include public place labels versus precise location data, bounded search and
message pagination, and viewer-dependent cache behaviour. Add coverage for
policy gaps without changing established behaviour unless a concrete defect is
confirmed.

#### Scenario: Anonymous visitor cannot read member-only surfaces

- **WHEN** an anonymous visitor requests a profile, avatar, member search,
  private message or data export
- **THEN** the route applies its documented authentication requirement

#### Scenario: Public profile includes only deliberate public fields

- **WHEN** an available member reads another available member's profile
- **THEN** approved public identity and member-entered place labels are
  available
- **AND** precise location data and account, credential, or unapproved fields
  are omitted

#### Scenario: Visibility and block policy agree across member surfaces

- **WHEN** a member reads, searches for, or requests the avatar of a blocked,
  suspended, shadowbanned, or administrator account
- **THEN** the corresponding profile, search, avatar and moderation policy is
  applied consistently

#### Scenario: Bounded results and viewer-dependent responses remain private

- **WHEN** member search or message history is paginated, or a profile response
  depends on the authenticated viewer
- **THEN** result bounds and pagination are enforced
- **AND** viewer-dependent profile responses are not marked for public shared
  caching
