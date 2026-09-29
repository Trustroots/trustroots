## ADDED Requirements

### Requirement: Recoverable experience drafts

The system SHALL save public experience drafts on the device for seven days,
scoped to the signed-in author and recipient. It SHALL offer explicit restoration
or discarding and SHALL exclude private moderator report text. Storage failures
SHALL leave the form usable and communicate that device recovery is unavailable.

#### Scenario: Member returns after a phone loses power

- **WHEN** a member reopens an unsaved experience within seven days on the same device
- **THEN** the form offers to restore or discard their saved draft
- **AND** restoring recovers public feedback, interactions and recommendation

#### Scenario: Draft belongs to another member or recipient

- **WHEN** the signed-in author or recipient differs from the draft's member pair
- **THEN** the form does not restore or display that draft

#### Scenario: Member confirms saving or discards a draft

- **WHEN** a member's experience is confirmed saved or they discard the draft
- **THEN** the corresponding device draft is removed

### Requirement: Clear experience saving outcomes

The system SHALL show an explicit saving state and confirmed saved state. It SHALL
check uncertain saves before requiring retry and SHALL show saved confirmation
independently of optional private-report delivery. It SHALL display the configured
feedback limit and prevent submission of oversized feedback without removing text.

#### Scenario: Save response is lost

- **WHEN** saving fails with a transport error, server error or conflict
- **THEN** the system reads back the current author's experience once
- **AND** only a confirmed saved experience produces success
- **AND** an unconfirmed save leaves the draft editable and retry available

#### Scenario: Private report is still sending

- **WHEN** an experience is saved and an optional private report is pending
- **THEN** saved confirmation is shown immediately with report sending status
- **AND** a failed report can be retried without saving the experience again

#### Scenario: Feedback exceeds the configured limit

- **WHEN** public feedback exceeds the configured character limit
- **THEN** the form shows the character count and an explanation
- **AND** saving is disabled until the member shortens the feedback
