---
layout: default
title: Welcoming new members
permalink: /welcome/
---

# Welcoming new members

Trustroots works best when members can understand one another's plans and
expectations. This guide gathers practical advice for people joining the
community and for the team supporting them.

## For members

### Make your profile useful

Add a description that helps people decide whether you might be a good fit to
meet or host one another. You could mention what brings you to Trustroots, your
interests, how you like to travel, and what you can offer or are looking for.
Keep personal details you do not want to share out of your public profile.

[Edit your profile](https://www.trustroots.org/profile/edit)

If you are unsure how something works, start with the
[frequently asked questions](https://www.trustroots.org/faq). For account or
community support, contact the team through
[Trustroots support](https://www.trustroots.org/support).

### Meet people locally

Trustroots is also a way to meet community members. Add a meetup offer with
enough detail for people to understand what you have in mind, such as the kind
of activity and when you are available. Share only details you are comfortable
making visible to other members.

[Create a meetup](https://www.trustroots.org/offer/meet)

### Share feedback

Tell us what was clear, what was difficult, or what would have helped you get
started. You can use the [support form](https://www.trustroots.org/support) or,
if you receive a welcome email, reply to it.

## For the team

These notes document the former three-step welcome email sequence. Its templates
and sending functions remain in the codebase, but all three background job
handlers are currently no-ops. The sequence is not an active member onboarding
feature.

All three former jobs selected public members, excluded members with suspended
or shadowban roles, and limited each batch to 50 members. Each selected members
at its welcome step whose `welcomeSequenceSent` timestamp was older than the
wait configured for that step. After each successful send, the job updated that
timestamp and advanced the member's welcome step.

1. **First email (step 0):** encouraged a new member to complete their profile
   and linked to the FAQ. The configured wait followed email confirmation.
2. **Second email (step 1):** asked for first impressions and invited the member
   to create a meetup. The configured wait followed the previous welcome email.
3. **Third email (step 2):** checked the member's description length: shorter
   descriptions received a profile reminder; others were asked for feedback.
   The configured wait followed the previous welcome email.

The handlers for all three steps now finish immediately without querying
members, sending email, or updating welcome-sequence progress. Do not describe
these messages as scheduled or promise that a member will receive them. The
member guidance above is available independently of that automation.
