# Shared member dashboard

## Why

Issue #3533 asks for a useful signed-in home instead of circle discovery. In the
incremental Compose migration (#3232), introduce that home in common code so
Android and iOS can evaluate the same screen before replacing native defaults.
The web homepage already has separate improvements from #3708.

## What changes

- Start the signed-in shared pilot at Home with shortcuts to the existing shared
  profile and inbox and an explanation linking to the Nostroots introduction.
- Keep those actions available without profile, circle or local-event data.
- Preserve the existing session bridge, native exit, and journey Back behaviour.

## Scope

This is a pilot increment, not completion of #3533 or #3232. Native release
navigation stays unchanged. Profile-completion prompts, event integration,
localisation, and migration of the native Android home tab remain follow-ups.
