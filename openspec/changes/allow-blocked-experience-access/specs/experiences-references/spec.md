## ADDED Requirements

### Requirement: Experience access after a block

A member blocked by an available member SHALL be able to write an Experience for that member and view their own non-removed Experience in a limited profile view, including a report to support action. The view SHALL disclose only the recipient's minimal identity and the viewer's own Experience.

#### Scenario: Blocked member shares an Experience

- **WHEN** a blocked member visits the blocker's profile without an existing Experience
- **THEN** they can open the Experience form and report the member to support
- **AND** existing submission eligibility and moderation rules apply

#### Scenario: Blocked member revisits their Experience

- **WHEN** a blocked member visits the blocker's profile after sharing an Experience
- **THEN** they can see their own non-removed Experience and report the member to support
- **AND** other Experiences and protected profile information are not shown
