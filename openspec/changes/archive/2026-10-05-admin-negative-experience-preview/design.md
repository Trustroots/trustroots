# Design: Admin negative-experience feedback preview

Render the `feedbackPublic` value already returned by the admin dashboard API
in a small reusable dashboard-local preview control. Keep its text in the
initial response and render it as text, preserving newlines with CSS. Do not
fetch on hover and do not interpret the feedback as HTML.

Use a button-like date trigger that opens the preview on pointer hover, keyboard
focus, or tap. The preview is labelled by its trigger, remains open while the
pointer moves into it, and closes on Escape or when focus/pointer leaves. On
touch devices, tapping toggles the preview. Provide a visible unavailable-text
message when public feedback is empty or missing. Keep the existing date
fallback and dashboard row layout.

Cover initial text rendering, preserved line breaks, missing feedback, hover,
focus, Escape, and touch toggle in client tests. Add an anonymous E2E scenario
that verifies the seeded public feedback is previewable on the admin dashboard
at desktop and mobile widths.
