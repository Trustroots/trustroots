# Site Analytics Specification

## Purpose

Load Trustroots analytics consistently and safely for the active application
environment.

## Requirements

### Requirement: Environment-specific analytics configuration

The system SHALL load the Umami analytics script using the script address and
website identifier configured for the active application environment when analytics is enabled.
Analytics SHALL load asynchronously without holding up document readiness.
Operators SHALL be able to disable script loading with `umami.enabled: false`.

#### Scenario: Application renders a page with analytics configured

- **WHEN** the application renders a page in an environment with Umami configuration
- **THEN** the page includes the configured Umami script and website identifier

### Requirement: Analytics content security policy

The system SHALL allow the configured Umami analytics origin in its content
security policy so that analytics requests can complete.

#### Scenario: Browser loads the configured analytics script

- **WHEN** a browser loads a page with Umami analytics configured
- **THEN** the content security policy permits the configured analytics script and its requests

#### Scenario: Analytics is disabled or unavailable

- **WHEN** an operator disables analytics or the analytics host is unavailable
- **THEN** the application renders and authentication remains independent of analytics delivery
