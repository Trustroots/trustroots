# volunteering-chat Specification

## Purpose

Give members a dedicated place to ask questions and discuss volunteering.

## Requirements

### Requirement: Dedicated volunteering chat

The volunteering page SHALL show signed-in members kind-1 Nostr events tagged
`trustroots-volunteering` on the authenticated Trustroots relay. Members SHALL
be able to post with a matching verified signer or via Trustroots as specified
by mixed circle chat. `/volunteers` SHALL redirect to `/volunteering`.

#### Scenario: A visitor opens the volunteering page

- **WHEN** a visitor opens `/volunteering`
- **THEN** the page offers sign-in with a return link to volunteering
- **AND** the application does not subscribe to the volunteering topic
- **AND** the volunteer enquiry and Team Guide links remain available

#### Scenario: A signed-in member opens the volunteering page

- **WHEN** a signed-in member opens `/volunteering`
- **THEN** the member can read volunteering messages without connecting a signer
- **AND** they can publish to the topic using the signing path for their account
