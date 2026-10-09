## ADDED Requirements

### Requirement: Dashboard previews negative-experience feedback

The admin dashboard SHALL expose the public feedback text for each recent
negative experience in a responsive preview attached to its date. The complete
text SHALL be available on hover and keyboard focus, and togglable by touch.
The preview SHALL preserve line breaks, render text without interpreting HTML,
close on Escape, and show a clear fallback when feedback is unavailable.

#### Scenario: Administrator previews public feedback

- **WHEN** an administrator hovers over, focuses, or taps a negative experience
  date
- **THEN** the dashboard shows that experience's complete public feedback
- **AND** line breaks in the feedback remain visible
- **AND** the feedback is rendered as plain text

#### Scenario: Administrator dismisses a preview

- **WHEN** an administrator presses Escape while a preview is open
- **THEN** the preview closes and focus remains on its date control

#### Scenario: Public feedback is unavailable

- **WHEN** a negative experience has no public feedback text
- **THEN** the preview explains that the text is unavailable
