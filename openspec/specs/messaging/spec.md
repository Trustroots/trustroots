# Messaging Specification

## Purpose

Let eligible members communicate privately while protecting message visibility
and conversation state.

## Requirements

### Requirement: Member-only messaging

The system SHALL require an eligible signed-in member for messaging APIs and
messaging pages.

#### Scenario: Signed-out visitor opens messaging

- **WHEN** a signed-out visitor opens a messaging route or API
- **THEN** the system requires the visitor to sign in

#### Scenario: Unconfirmed member opens messaging

- **WHEN** an unconfirmed member opens their inbox
- **THEN** the system prompts them to confirm their profile
- **AND** restricted messaging actions remain unavailable

### Requirement: Inbox and conversation viewing

The system SHALL show a member's available conversation summaries, let them
filter to unread conversations, and let them open a conversation with its message
history. The unread view SHALL include conversations counted by the unread badge
and preserve the filter while paginating. The inbox SHALL let members filter
conversations by the other member's name or username and the latest message
preview, including conversations beyond the first page.

#### Scenario: Member opens their inbox

- **WHEN** a member opens their inbox
- **THEN** the system displays available conversation summaries

#### Scenario: Member filters to unread conversations

- **WHEN** a member selects the unread inbox view
- **THEN** the system displays their unread conversations, including ones older
  than the first page of the full inbox
- **AND** the member can open those conversations

#### Scenario: Member opens a conversation

- **WHEN** a member opens an available conversation
- **THEN** the system displays its message history and paginated replies

#### Scenario: Member filters conversations by text

- **WHEN** a member enters text matching another member or a latest message preview
- **THEN** matching conversations appear even if they were on an older inbox page

### Requirement: Message visibility protection

The system SHALL not show messages or conversation summaries hidden from a
recipient by moderation visibility rules.

#### Scenario: Recipient has a shadow-hidden sender

- **WHEN** a member opens their inbox or a conversation containing a shadow-hidden sender
- **THEN** the hidden sender's messages are not shown to that member

### Requirement: Conversation creation and replies

The system SHALL let eligible members start a conversation and send a reply,
while rejecting invalid recipients and empty message content. Before an
opening message is sent, and until the current member sends their first reply,
the conversation experience SHALL provide a link to the public safety guidance.
On desktop, the reply editor SHALL receive focus when it appears. After a
successful send, the recreated reply editor SHALL receive focus so the member
can continue typing.

#### Scenario: Member opens a new conversation

- **WHEN** a member opens a conversation with no messages
- **THEN** the empty state provides a link to the public safety guidance

#### Scenario: Member has not replied to an incoming conversation

- **WHEN** a member opens a conversation containing messages only from the
  other member
- **THEN** the reply experience provides a link to the public safety guidance

#### Scenario: Member opens a conversation on desktop

- **WHEN** a member opens a conversation with an available reply editor on desktop
- **THEN** the reply editor receives keyboard focus

#### Scenario: Member sends a reply

- **WHEN** a member successfully sends a reply
- **THEN** the recreated reply editor receives keyboard focus

#### Scenario: Member sends an opening message

- **WHEN** a member sends a valid opening message to another eligible member
- **THEN** the system creates the conversation and displays the message

#### Scenario: Member submits an empty message

- **WHEN** a member submits an empty reply
- **THEN** the system rejects the reply and displays validation feedback

### Requirement: Message status synchronisation

The system SHALL provide a member's unread-message state and update it when
messages are read or synchronised.

#### Scenario: Member reads a message

- **WHEN** a member reads an unread message
- **THEN** the system updates the unread state available to that member

### Requirement: Moderation-safe reply statistics

The system SHALL exclude messages hidden by restricted-member moderation rules
from reply-rate and reply-time accounting.

#### Scenario: Restricted member sends a shadow-hidden message

- **WHEN** a suspended or shadowbanned member sends a message that is hidden
  from its recipient by moderation rules
- **THEN** the message does not create or update reply statistics

#### Scenario: Available member sends a visible message

- **WHEN** an available member sends a visible message
- **THEN** normal reply-rate and reply-time accounting continues

### Requirement: Staff exemption from message recipient throttling

The system SHALL exempt authenticated senders with the `welcome-team` or `admin` role from the distinct-recipient message throttle. All other message validation and moderation rules SHALL continue to apply. Senders without either role SHALL remain subject to the configured throttle.

#### Scenario: Welcome team or administrator exceeds the recipient limit

- **GIVEN** a sender has either the `welcome-team` or `admin` role and has exceeded the recipient limit
- **WHEN** they send an otherwise valid message
- **THEN** the message is accepted without applying the recipient throttle

#### Scenario: Ordinary member exceeds the recipient limit

- **GIVEN** a sender has neither exempt role and has exceeded the recipient limit
- **WHEN** they send a message
- **THEN** the system rejects the message with HTTP 429

#### Scenario: Exempt role is removed

- **GIVEN** a sender has exceeded the recipient limit and no longer has either exempt role
- **WHEN** they next send a message
- **THEN** the system applies the ordinary recipient throttle

### Requirement: React messaging pages

The system SHALL render the inbox and conversation pages with the React
application shell while preserving existing messaging access and behaviour.

#### Scenario: Member opens the inbox

- **WHEN** an authenticated member opens `/messages`
- **THEN** the React shell displays their conversations and unread count
- **AND** inbox pagination continues to use the existing message API

#### Scenario: Member opens and replies to a conversation

- **WHEN** an authenticated member opens `/messages/:username`
- **THEN** the React shell displays the existing thread and reply controls
- **AND** read state and unread count update through the existing APIs

#### Scenario: Angular page links to messaging

- **WHEN** a member follows an Angular named-state link to the inbox or thread
- **THEN** the browser opens the matching React-owned URL

#### Scenario: Visitor opens a messaging page

- **WHEN** a signed-out visitor opens a messaging URL
- **THEN** the page redirects to sign in without displaying messages

### Requirement: External message links are inert

The system SHALL display all links in message bodies and draft previews as non-clickable text while preserving visible labels and supported formatting, including links to the current Trustroots origin. The rule SHALL apply to previously stored messages as well as new messages.

#### Scenario: Member views an external link in a message

- **WHEN** a member opens a conversation containing a message with an external link
- **THEN** its label is visible without a clickable link

#### Scenario: Member views an internal link in a message

- **WHEN** a member opens a conversation containing a link to the current Trustroots origin
- **THEN** its label is visible without a clickable link

### Requirement: Hosting replies require an incoming conversation

Hosting quick replies SHALL appear only when the thread contains a received message and the current member has not yet replied. Empty conversations and conversations containing only the current member's messages SHALL offer the normal message editor without hosting quick replies.

#### Scenario: Member starts a conversation or waits for a response

- **WHEN** a member opens an empty conversation or a conversation containing only their own messages
- **THEN** hosting quick reply buttons are hidden

#### Scenario: Member receives their first message

- **WHEN** a member opens a conversation containing messages from the other member and has not replied yet
- **THEN** hosting quick replies are available as reply options

### Requirement: Representative reply statistics

Reply statistics SHALL exclude deleted senders and conversations started by current `welcome-team` members before the existing statistics window selection. Fewer than three selected eligible conversations SHALL yield null reply rate and time, formatted as empty strings. Three or more eligible conversations SHALL retain the existing calculation, including a legitimate zero reply rate. Current roles SHALL apply to historical conversations without migration.

#### Scenario: Welcome conversations leave an insufficient sample

- **WHEN** excluding current greeter conversations leaves fewer than three eligible conversations
- **THEN** both reply statistics are unavailable

#### Scenario: Three unanswered eligible conversations

- **WHEN** three eligible conversations have no replies
- **THEN** reply rate is zero and reply time is unavailable

### Requirement: Named empty conversation

An empty conversation SHALL display translatable text identifying the recipient by public display name, falling back to username and then the existing generic text. The name SHALL be selectable text and safely interpolated.

#### Scenario: Recipient has a display name

- **WHEN** a member opens an empty conversation with a named recipient
- **THEN** the heading says they have not been talking with that name yet

### Requirement: Optional draft message preview

The composer SHALL offer a translatable, accessible Preview / Edit toggle for non-empty opening messages and replies on desktop and mobile. Preview SHALL display the formatted draft in an outgoing message bubble labelled Message preview, without sent metadata. Send SHALL remain available in both views and SHALL submit the original draft.

#### Scenario: Member previews and edits a draft

- **WHEN** a member selects Preview for a non-empty draft
- **THEN** the composer shows formatted content using existing message formatting and link rules
- **AND** selecting Edit restores the draft and editor focus without changing cached content

#### Scenario: Preview formatting fails or finishes late

- **WHEN** preview formatting fails
- **THEN** the composer offers a retry and preserves the draft
- **AND** responses after leaving preview or changing conversations are ignored

#### Scenario: Member sends from preview

- **WHEN** a member sends from preview
- **THEN** the original draft is submitted through the existing send flow
- **AND** success clears the draft and returns to a focused editor
- **AND** failure preserves the draft and selected view

### Requirement: Side-effect-free draft formatting

The system SHALL offer authenticated POST /api/messages-preview accepting a string content field and returning a content field formatted by the existing server text service. Preview SHALL NOT persist messages or alter threads, read state, notifications or statistics.

#### Scenario: Eligible member requests a preview

- **WHEN** an eligible authenticated member posts draft content
- **THEN** the system returns sanitised, formatted content without message side effects

#### Scenario: Visitor requests a preview

- **WHEN** a signed-out visitor requests a preview
- **THEN** access is denied

#### Scenario: Invalid content is submitted

- **WHEN** the content field is missing, non-string or empty after stripping markup
- **THEN** the system rejects the preview request

### Requirement: Resizable message composer

The system SHALL let members resize the opening-message and reply composer by dragging its top handle upwards or downwards using a mouse or touch. The handle SHALL support keyboard resizing. Resizing SHALL preserve the draft and preview state, fit within the available conversation area and keep Send visible. Drafts exceeding the selected height SHALL remain scrollable. A successful send SHALL restore the default composer size.

#### Scenario: Member resizes a draft

- **WHEN** a member drags the handle upwards or downwards
- **THEN** the writing area grows or shrinks within its size limits
- **AND** the draft content is preserved

#### Scenario: Member resizes using the keyboard

- **WHEN** the handle has focus and the member presses Arrow Up or Arrow Down
- **THEN** the writing area grows or shrinks
- **AND** Home and End select the minimum and maximum sizes

#### Scenario: Member previews or sends a resized draft

- **WHEN** a member switches between editing and preview
- **THEN** the draft and selected composer size are preserved
- **AND** Send remains available
- **AND** sending successfully restores the default size

#### Scenario: Available mobile height changes

- **WHEN** the viewport or virtual keyboard changes the available height
- **THEN** the resized editor fits the available conversation area
- **AND** the handle and Send action remain visible

### Requirement: Messaging without external spam classification

The system SHALL send eligible member messages without contacting an external spam-classification service. New messages SHALL have no automatically assigned spam classification. Existing stored spam flags SHALL remain readable, and existing delivery, notification, throttling, blocking and manual moderation behaviour SHALL remain unchanged.

#### Scenario: A member sends a message

- **WHEN** an eligible member sends a valid message
- **THEN** the message is saved and available to its recipient without external classification or a new spam flag
- **AND** the conversation and notification state follows the existing delivery rules

#### Scenario: A restricted sender sends a message

- **WHEN** a suspended or shadowbanned member uses the existing restricted delivery path
- **THEN** the existing hidden-delivery behaviour remains in effect

#### Scenario: A historical message has a stored classification

- **WHEN** historical message metadata is read or processed for statistics
- **THEN** its stored spam classification is preserved

### Requirement: Hosting details in ordinary conversations

Members SHALL be able to opt into hosting mode in the existing message composer.
Hosting messages SHALL remain messages in the same conversation and SHALL include
a guest count defaulting to one. Arrival and departure SHALL either both be absent
or be real calendar dates with departure after arrival. The guest count SHALL be
an integer from one to one hundred. Ordinary messages SHALL remain available.

#### Scenario: Dates unknown

- **WHEN** a member sends a hosting message without dates
- **THEN** its guest count and text appear in the conversation
- **AND** no dates are invented

#### Scenario: Invalid visit details

- **WHEN** hosting details have a partial or invalid date range or invalid guest count
- **THEN** sending is rejected without saving a message

### Requirement: Hosting description reminder and acknowledgement

Hosting mode SHALL show the recipient's active hosting description and a gentle
reading reminder. The optional host preference SHALL require an initially
unchecked acknowledgement only for the first hosting message visible in the
conversation. Ordinary message history SHALL not count as a hosting message.
The server SHALL determine this using all visible history, not a page of results.
Expired offers and incoming shadow-hidden history SHALL be ignored.

#### Scenario: Ordinary contact

- **WHEN** a member sends an ordinary message to an opted-in host
- **THEN** no hosting acknowledgement is required

#### Scenario: First hosting message after ordinary messages

- **GIVEN** a host opted in and no visible hosting message exists between the members
- **WHEN** either member sends hosting details to that host
- **THEN** literal boolean acknowledgement is required
- **AND** an unchecked send is rejected without saving a message

#### Scenario: Later hosting message

- **GIVEN** a visible hosting message already exists in the conversation
- **WHEN** another hosting message is sent
- **THEN** no repeated acknowledgement is required

#### Scenario: Preference changes while composing

- **WHEN** the server rejects a hosting send because acknowledgement became required
- **THEN** the client refreshes hosting context and keeps the text and visit details

#### Scenario: Hosting context cannot be loaded

- **WHEN** hosting context loading fails
- **THEN** hosting mode offers a retry and does not send until context is loaded
- **AND** the member can switch back to an ordinary message

### Requirement: Contextual hosting replies

Hosting reply shortcuts SHALL appear only when an incoming hosting message exists
after the member's latest outgoing message. Shortcuts SHALL send ordinary messages
using the existing yes/no hosting reply format, without creating booking status.

#### Scenario: Ordinary incoming message

- **WHEN** the latest unanswered incoming messages have no hosting details
- **THEN** hosting reply shortcuts are absent

#### Scenario: Hosting question and response

- **WHEN** an incoming hosting message has not been answered
- **THEN** hosting reply shortcuts are available
- **AND** sending a reply hides them until a later incoming hosting message
