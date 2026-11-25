## ADDED Requirements

### Requirement: Android can edit ongoing meeting availability and volunteering

The Android hosting editor SHALL load and save ongoing meeting availability
and volunteering as part of its existing host offer. It SHALL preserve the
saved coordinates, accept a member-chosen location for new offers and support
hosting availability of No with ongoing meeting availability enabled.

#### Scenario: Edit an offer created on the web

- **GIVEN** the member already has a host offer with meeting availability and
  volunteering set
- **WHEN** the member opens the hosting editor, edits availability and saves
- **THEN** the editor uses the existing offer identifier and saved coordinates
- **AND** the saved meeting and volunteering values match the controls
- **AND** a subsequent edit still updates the same offer.

## MODIFIED Requirements

### Requirement: Navigation-scoped Android Host Offer state

The Android Host offer editor SHALL keep its load, editable form, validation,
save transaction and outcome state in a ViewModel scoped to its existing
Navigation 3 menu entry. The ViewModel SHALL expose immutable UI state and
explicit events and SHALL use an injectable repository. The repository SHALL
load the member profile before the accommodation offer and SHALL normalise
offer HTML into trimmed editable text outside the ViewModel. The ViewModel
SHALL validate and save the complete offer. It
SHALL retain no session credential or translated fallback string in UI or
saved state. API failures SHALL retain nonblank server text and failure kind
until Compose resolves an XML fallback at render time. Removing the menu entry
or signing out SHALL cancel its outstanding work and clear its state.

#### Scenario: Member opens an existing Host offer

- **WHEN** the Host offer entry loads the signed-in member's profile and
  accommodation offer successfully
- **THEN** the existing offer values are shown as editable plain text
- **AND** HTML markup is decoded and trimmed before it reaches the form
- **AND** the original complete offer is retained as the dirty-form baseline

#### Scenario: Member starts with no Host offer

- **WHEN** the profile read succeeds and offers-by returns an empty list or
  HTTP 404
- **THEN** availability defaults to `yes`, descriptions are empty, maximum
  guests is `1`, show-only-in-my-circles is false, and the location is blank
- **AND** the member must enter valid coordinates before saving
- **AND** the form is not treated as a failed load

#### Scenario: Host offer load fails

- **WHEN** either the profile read or offer read fails for a reason other than
  authentication
- **THEN** the form remains in a failed-load state and is not presented as a
  new offer
- **AND** Retry repeats the profile-then-offer sequence
- **AND** a nonblank server message is shown when present; otherwise an API-kind
  or Host-offer XML fallback is resolved at render time

#### Scenario: Member edits and validates a Host offer

- **WHEN** the member edits availability, descriptions, maximum guests or the
  circle-only setting or location
- **THEN** dirty state compares the current complete offer with the loaded or
  last-saved baseline
- **AND** hosting availability requires at least five trimmed description
  characters while `no` availability does not
- **AND** maximum guests accepts whole numbers in the range of 0–99

#### Scenario: Member saves a Host offer

- **WHEN** the member saves a valid form
- **THEN** exactly one immutable snapshot of all current fields is submitted
- **AND** a successful response updates the offer ID and saved baseline from
  that snapshot
- **AND** translated success text is resolved from XML when displayed

#### Scenario: Host offer save fails

- **WHEN** saving fails for a reason other than authentication
- **THEN** the form values and dirty baseline remain available for another
  attempt
- **AND** the error retains nonblank server text and API failure kind until
  render-time XML fallback resolution

#### Scenario: Member leaves a changed Host offer

- **WHEN** the member uses Cancel, system or predictive Back, or top-level
  navigation with unsaved changes
- **THEN** the existing keep-editing or discard decision is shown
- **AND** keeping edits preserves the Host entry and all entered values
- **AND** an in-flight save blocks navigation until it completes

#### Scenario: Activity is recreated during Host offer work

- **WHEN** Android recreates the Activity while Host offer loading or saving is
  in progress
- **THEN** the entry-scoped ViewModel retains its form and transaction state
- **AND** the same operation completes without a duplicate profile, offer or
  save request

#### Scenario: Host offer entry is removed

- **WHEN** Navigation 3 removes the Host menu entry or the member signs out
- **THEN** its ViewModel cancels outstanding work and clears its form state
- **AND** a later Host entry starts fresh from the live authenticated session
