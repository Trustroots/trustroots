# Product analytics

Trustroots sends page views, product events and Web Vitals to its self-hosted Umami instance at `1p.trustroots.org`. Components record events with `useAnalytics().track(name, data)` from `@trustroots/analytics/client`; names and data are typed by the catalogue in `packages/analytics/shared/events.ts`, so a typo or an unknown property fails type checking. This page lists every event. A unit test (`modules/core/tests/client/services/analytics-events.tests.ts`) fails when this list and the catalogue differ.

## Rules for event data

- No personal data: no usernames, email addresses, ids of any member, thread, offer, circle or experience, no free text, message or experience content, place names, search queries or coordinates.
- Data is coarse: enum-like strings from fixed lists, small counts and HTTP statuses. Languages and navigation items are fixed lists too; anything outside them is not sent. The `reason` on a `*_failed` event comes from the HTTP status alone, never from the server's message. Booleans are `yes` or `no`, because Umami event data is string or number only.
- Names are snake_case `<object>_<past-tense verb>`. Outcomes are tracked after the API call settles, not on click.
- Every event must answer a question someone would act on (see below). If MongoDB, the statistics module, the admin pages or Umami's page views already answer it, there is no event for it.
- Do-Not-Track (`data-do-not-track="true"`), the `umami.disabled` local storage opt-out and `umami: { enabled: false }` in config stop every event, page view and Web Vitals report. The native apps have their own opt-in analytics and do not send these events.

## Page URLs

Umami stores the page URL and the previous page's URL with every page view, event and Web Vitals report. Profile, thread and contact URLs contain usernames or ids, and some links contain tokens. The URL scrubbing hook ([#3543](https://github.com/Trustroots/trustroots/pull/3543)) replaces those path segments with route templates such as `/profile/:username`, sends URLs that match no route as `/not-found`, and drops query strings before anything is sent. The events below rely on it: they are only free of personal data once the URL is too. That is also why the catalogue has no events of the form "member A did X to member B", such as blocks, reports, contact confirmations or experiences.

## Web Vitals

The script tag sets `data-performance="true"`, so the tracker reports LCP, INP, CLS, FCP and TTFB for each page view to the Umami Performance view. It is sent to the same `/api/send` endpoint as other events.

## Questions and the events that answer them

| Question                                                                 | Events                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Where do visitors drop out of signup, and why?                           | `signup_step_viewed`, `signup_failed`, `signup_completed`                                                                       |
| Do new members confirm their email, and do confirmation links break?     | `signup_completed`, `email_confirmed` (`kind: signup`), `email_confirm_failed` by `reason`                                      |
| Are members locked out, and by what?                                     | `signin_failed` by `reason`, `password_reset_requested`, `password_reset_completed`, `password_reset_failed` by `reason`        |
| Which parts of the profile do members fill in, and which saves fail?     | `profile_section_saved`, `profile_save_failed` by `section` and `reason`                                                        |
| How many would-be guests does the profile-length rule stop from writing? | `message_gate_shown` (`reason: profile_too_short`) against first `message_sent`                                                 |
| Which surface turns browsing into reaching out?                          | `search_offer_previewed`, `profile_viewed`, first `message_sent` and `contact_request_sent` by `source`                         |
| Where do searches find nobody, and do filters cause it?                  | `search_no_results` by `zoom` and `filters`                                                                                     |
| Which search filters are used, so unused ones can go?                    | `search_filter_changed`, `search_place_selected`                                                                                |
| Do members answer each other, or only chase their own messages?          | `message_sent` `kind: reply` against `kind: followup`. The reply rate itself comes from the database (`MessageStat`), not here. |
| How often does the message rate limit stop members?                      | `message_send_failed` (`reason: rate_limited`) against `message_sent`                                                           |
| Is hosting supply growing, and do offer saves fail?                      | `offer_saved` by `status`, `offer_deleted`, `offer_save_failed` by `reason`                                                     |
| Does anyone use community notes on the map?                              | `search_community_note_opened`, `search_filter_changed` (`community_notes`)                                                     |
| Which circle surfaces bring members?                                     | `circle_joined` and `circle_left` by `source`                                                                                   |
| What do members need support for?                                        | `support_request_sent` by `category`                                                                                            |
| Which interface languages matter for translation?                        | `language_switched`                                                                                                             |
| Which navigation links are used?                                         | `navigation_clicked`                                                                                                            |
| Did the last deploy break something?                                     | `api_request_failed`, `client_error`, `page_not_found`, Web Vitals                                                              |

## Events

### Signup

| Event                 | Data                                                  | When                                                                                                                     |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `signup_rules_opened` | none                                                  | The rules are opened from the signup form.                                                                               |
| `signup_step_viewed`  | `step`: 1, 2 or 3                                     | A signup step is shown to a signed-out visitor: 1 account details, 2 circles, 3 done. Signed-in visitors are redirected. |
| `signup_failed`       | `reason`: `age_not_confirmed`, `email_taken`, `other` | Signup is rejected. The server answers 400 for every failure, so only an existing email can be told apart from the rest. |
| `signup_completed`    | `referred_circle`: yes/no                             | An account is created; says whether signup started from a circle link.                                                   |

### Email confirmation, sign-in and account

| Event                      | Data                                                             | When                                                                                                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email_confirmed`          | `kind`: `signup` or `change`                                     | An email confirmation link succeeds. `signup` is the first confirmation, which makes the profile public.                                                                                                                                                                                            |
| `email_confirm_failed`     | `reason`: `invalid_link` or `server`                             | An email confirmation link fails. `invalid_link` is a 400: the token is unknown, already used or expired. The server answers all three with one query and one message, so an expired link can't be told from an invalid one. `server` is any other status or no response.                           |
| `signin_succeeded`         | none                                                             | Sign-in succeeds.                                                                                                                                                                                                                                                                                   |
| `signin_failed`            | `reason`: `credentials`, `suspended`, `rate_limited` or `server` | Sign-in is rejected: 400 for an unknown user or wrong password (one answer for both), 403 for a suspended account, 429 from the sign-in limit, `server` for anything else (503 when the password service is busy, 5xx, no response). Unconfirmed members can sign in, so there is no `unconfirmed`. |
| `password_reset_requested` | none                                                             | A password reset email is requested.                                                                                                                                                                                                                                                                |
| `password_reset_completed` | none                                                             | A new password is saved from a reset link.                                                                                                                                                                                                                                                          |
| `password_reset_failed`    | `reason`: `invalid_link`, `rate_limited` or `server`             | Saving a new password from a reset link fails. `invalid_link` is a 400, an unknown, used or expired token (one answer for all three; the form already checks length and that both fields match). `rate_limited` is a 429 from the reset limit; `server` is anything else.                           |
| `account_removed`          | none                                                             | An account removal link is confirmed.                                                                                                                                                                                                                                                               |

### Profile

| Event                   | Data                                                              | When                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile_section_saved` | `section`: `about`, `account`, `locations`, `networks` or `photo` | A profile editor section is saved. Languages save with `about`; `account` covers email, username, password and newsletter.                                                                                                                                                          |
| `profile_save_failed`   | `section`: as above; `reason`: `validation` or `server`           | Saving a profile editor section fails, including a photo upload. `validation` is a 400 (the server rejected the data, such as a taken email or a wrong current password) or, for photos, 413 (too big) or 415 (unsupported type). `server` is anything else, including no response. |
| `profile_viewed`        | `own`: yes/no                                                     | A profile loads, once per profile while the page stays open; says whether it is the member's own profile.                                                                                                                                                                           |

### Offers

| Event               | Data                                                                                                 | When                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `offer_saved`       | `type`: `host` or `meet`; `action`: `create` or `update`; `status` (hosting): `yes`, `maybe` or `no` | A hosting or meet offer is created or updated.                                                                                                |
| `offer_save_failed` | `type`; `reason`: `validation` or `server`                                                           | Saving a hosting or meet offer fails. `validation` is a 400, the server rejecting the data; `server` is anything else, including no response. |
| `offer_deleted`     | `type`                                                                                               | A meet offer is deleted.                                                                                                                      |

### Search and map

| Event                          | Data                                                                                            | When                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `search_place_selected`        | `source`: `suggestion` or `query`                                                               | A place is located from the search box, by picking a suggestion or pressing Enter.                                            |
| `search_filter_changed`        | `filter`: `types`, `circles`, `my_circles`, `languages`, `online_recently` or `community_notes` | A search filter is changed.                                                                                                   |
| `search_no_results`            | `zoom`: rounded map zoom; `filters`: number of narrowing filters (circles, languages, no hosts) | The map moves into an area without offers. Counted once per move from an area with offers into one without; never says where. |
| `search_offer_previewed`       | none                                                                                            | An offer is opened from the search map or list.                                                                               |
| `search_offer_not_found`       | none                                                                                            | An offer link on the search map points nowhere.                                                                               |
| `search_community_note_opened` | none                                                                                            | A community note is opened, from the map or the search sidebar.                                                               |

### Reaching out

`source` says where reaching out to a member started: `search` (their search result), `offer` (the message button on their hosting offer), `profile` (the message or contact button on their profile) or `other` (a direct link, the inbox, a community note). It is remembered per browser tab in `sessionStorage` until the message or request is sent; search outranks the offer button, which outranks the profile, so "search result, then profile, then message" counts as `search`.

| Event                   | Data                                                                                                  | When                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `contact_request_sent`  | `source`                                                                                              | A contact request is sent. An "already connected" answer sends nothing.                                                                      |
| `message_thread_opened` | `unread`: yes/no                                                                                      | A message thread loads; says whether it had unread messages from the other member.                                                           |
| `message_gate_shown`    | `reason`: `not_public` or `profile_too_short`                                                         | The thread hides the reply form: the member has not confirmed their email, or their profile is shorter than the minimum for a first message. |
| `message_sent`          | `kind`: `first`, `reply` or `followup`; `via`: `editor` or `quick_reply`; `source` (only for `first`) | A message is sent. `reply` means the other member has written in the thread; `followup` means only the sender has.                           |
| `message_send_failed`   | `reason`: `rate_limited` or `other`                                                                   | Sending a message fails. `rate_limited` is the 429 for writing to too many people too fast; `other` is any other status or no response.      |

### Circles

| Event           | Data                                                                    | When                |
| --------------- | ----------------------------------------------------------------------- | ------------------- |
| `circle_joined` | `source`: `circle_page`, `circles_list`, `signup`, `profile` or `other` | A circle is joined. |
| `circle_left`   | `source`: as above                                                      | A circle is left.   |

### Support

| Event                  | Data                                                                                                 | When                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------- |
| `support_request_sent` | `signed_in`: yes/no; `category`: `account`, `report_member`, `report_bug`, `volunteering` or `other` | The support form is sent. |

### Language and navigation

| Event                | Data                                                                                                    | When                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `language_switched`  | `language`: a code from `config/shared/locales.json`, else `other`; `saved`: yes/no                     | The interface language is switched; `saved` says whether storing it on the account worked.          |
| `navigation_clicked` | `surface`: `top` or `footer`; `item`: a slug from `NAVIGATION_ITEMS`, such as `search` or `support_faq` | A top navigation or footer link itself is used. Clicks in a submenu are not credited to its parent. |

### Errors

| Event                | Data                                                                                     | When                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page_not_found`     | none                                                                                     | The not-found page is shown. The broken path itself is not kept: unmatched URLs reach Umami as `/not-found`, so this counts broken links but does not name them.                                                                                                                                                                             |
| `api_request_failed` | `status`: HTTP status; `method`; `area`: first path segment after `/api/`, or `external` | An API request fails unexpectedly. Requests without a response (offline, cancelled, timed out) are skipped, and so are statuses a request expects by design, listed in its `expectedStatuses`: a 404 for "no offers" or "not a contact", a 404 for a removed member, a 409 for "already connected", a 401 or 403 from the unread-count poll. |
| `client_error`       | `kind`: `error` or `unhandled_rejection`                                                 | An uncaught error or unhandled promise rejection happens. Messages and stacks are not sent.                                                                                                                                                                                                                                                  |

## Not tracked, and why

- **Answered by the database or admin pages:** member blocks and reports, contact requests confirmed or removed, experiences and their recommendations, reference thread votes. These are also the "member A did X to member B" events.
- **Already page views:** profile tabs (they are URLs), the inbox's next page.
- **No decision depends on them:** sign-out, map base layer, clearing the circle filters, experience change requests, unblocking.
- **Already counted by `api_request_failed`:** per-feature failures of contact requests, account removal, circle joins and experiences.
- **Reply rate:** comes from `MessageStat.firstReplyCreated` in the database. No server event is sent.
- **Not features:** Trustroots has no invite or share feature. Map moves and zooms fire too often to be useful.

Server-side events are possible through `@trustroots/analytics/server` but none are recorded, so that native app requests and the browser opt-out are respected.

## Renamed events

The events that existed before this catalogue were renamed to the snake_case convention when it shipped: `signin-success` → `signin_succeeded`, `signin-failure` → `signin_failed`, `signup-rules-open` → `signup_rules_opened`, `offer-save` → `offer_saved`, `offer-delete` → `offer_deleted`, `search-offer-preview` → `search_offer_previewed`, `search-offer-not-found` → `search_offer_not_found`. `inbox-load-more` was dropped. Umami keeps the old names in its history, so dashboards need the new names from the deploy date on.
