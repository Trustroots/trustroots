# Enforce layer-to-app import boundaries

Issue #3358 tracks enforcing the repository's downward-only workspace tiers. Existing guards prevent shared packages and feature modules from importing upward, but production layer source can still import application composition from `apps/*`.

This change extends the existing source-import guard to reject production imports from `layers/*` into `apps/*`. It uses the same supported literal import forms and source exclusions as the module guard, while preserving layers' imports of feature modules, packages, root configuration and external dependencies.

This is a bounded developer-tooling change. It does not move application code or alter runtime imports.
