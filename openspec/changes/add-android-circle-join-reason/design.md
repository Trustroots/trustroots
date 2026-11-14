## Context

Native Android circle detail joins through the same membership controller as the web.

## Goals

- Offer one line of up to 160 characters next to the detail screen's Join button.
- Retain the reason during a failed attempt so members can retry.

## Decisions

Use an inline field so a member can still join with one tap. Send trimmed non-blank text in the existing POST body. Keep overview quick join and leave requests bodyless.
