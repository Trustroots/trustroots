## ADDED Requirements

### Requirement: Owned badges

The web client SHALL render badges, including counts, notification counters
and status tags, with the owned Badge primitive. Callers SHALL choose its
appearance through the primitive's variant, tone, size and shape options
rather than badge class names, and the primitive SHALL offer only options that
the client uses.

#### Scenario: Profile counts

- **WHEN** a profile shows its contacts or experiences count
- **THEN** the count is an owned Badge
- **AND** pending experiences add the Badge's notification indicator

#### Scenario: Unread messages

- **WHEN** a member has unread messages
- **THEN** the header's Messages link shows the count in an owned Badge at its
  end corner, in both reading directions

#### Scenario: Tests identify badges

- **WHEN** a test or stylesheet needs to find a badge
- **THEN** it uses the Badge's `data-slot`, `data-variant` and `data-tone`
  attributes instead of class names
