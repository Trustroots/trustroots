/**
 * Every product event Trustroots sends to Umami, with the data it may carry.
 *
 * Event data describes what happened, never who did it: no usernames, email
 * addresses, ids (of the member or anyone else), exact locations, free text or
 * message content. Values are short enum-like strings, small counts or HTTP
 * statuses, so the browser tracker and the server client accept the same data.
 * Booleans are sent as `'yes' | 'no'` because Umami event data is string or
 * number only.
 *
 * Umami also stores the page URL with every event. Usernames and tokens in
 * those URLs are scrubbed before sending (see `docs/analytics.md`), so this
 * catalogue does not add events whose meaning is "member A did X to member B".
 *
 * Names are snake_case `<object>_<past-tense verb>`. Adding an event means
 * adding it here and to `ANALYTICS_EVENTS` below; `docs/analytics.md` lists
 * the same set and a unit test keeps the three in step.
 */
type YesNo = 'yes' | 'no';

/** The offer types members can save. */
export type OfferType = 'host' | 'meet';

/** Sections of the profile editor that save on their own. */
export type ProfileSection =
  'about' | 'account' | 'locations' | 'networks' | 'photo';

/** Where a circle join or leave was started. */
export type CircleSource =
  'circle_page' | 'circles_list' | 'signup' | 'profile' | 'other';

/** Search filters a member can change. */
export type SearchFilter =
  | 'types'
  | 'circles'
  | 'my_circles'
  | 'languages'
  | 'online_recently'
  | 'community_notes';

/**
 * Where reaching out to another member started: a search result, the
 * message button on their hosting offer, their profile, or anywhere else
 * (a direct link, the inbox, a community note).
 */
export type OutreachSource = 'search' | 'offer' | 'profile' | 'other';

/** Why the thread hides the reply form from the current member. */
export type MessageGateReason = 'not_public' | 'profile_too_short';

/**
 * Why sign-in failed: unknown user or wrong password, a suspended account,
 * the sign-in rate limit, or a server error or no response.
 */
export type SigninFailureReason =
  'credentials' | 'suspended' | 'rate_limited' | 'server';

/** Why an email confirmation failed: a bad or expired link, or anything else. */
export type EmailConfirmFailureReason = 'invalid_link' | 'server';

/** Why saving a new password from a reset link failed. */
export type PasswordResetFailureReason =
  'invalid_link' | 'rate_limited' | 'server';

/** Why sending a message failed: the rate limit, or anything else. */
export type MessageSendFailureReason = 'rate_limited' | 'other';

/** Why a profile or offer save failed: rejected data, or anything else. */
export type SaveFailureReason = 'validation' | 'server';

/** The categories of the support form. */
export type SupportCategory =
  'account' | 'report_member' | 'report_bug' | 'volunteering' | 'other';

/** Navigation surfaces whose links are tracked. */
export type NavigationSurface = 'top' | 'footer';

/** Fixed slugs for tracked navigation links; never URLs. */
export const NAVIGATION_ITEMS = [
  // Top navigation
  'admin',
  'circles',
  'search',
  'messages',
  'host',
  'nostroots',
  'profile',
  'profile_edit',
  'contacts',
  'find_people',
  'account',
  'menu',
  'support_faq',
  'support_safety',
  'support_report_bug',
  'support_contact',
  // Footer
  'volunteering',
  'rules',
  'safety',
  'faq',
  'wiki',
  'privacy',
  'credits',
  'contact',
] as const;

export type NavigationItem = (typeof NAVIGATION_ITEMS)[number];

/**
 * Interface languages, the codes in `config/shared/locales.json`. A unit
 * test keeps the two lists equal. Anything else is sent as `other`.
 */
export const ANALYTICS_LANGUAGES = [
  'ar',
  'ca',
  'cs',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'lt',
  'lv',
  'nb',
  'nl',
  'pl',
  'pt',
  'pt_BR',
  'ro',
  'ru',
  'sl',
  'sr',
  'sv',
  'tr',
  'uk',
  'zh_Hans',
] as const;

export type AnalyticsLanguage = (typeof ANALYTICS_LANGUAGES)[number] | 'other';

/** Map a locale code to the fixed language list, or `other`. */
export function toAnalyticsLanguage(code: string): AnalyticsLanguage {
  return (ANALYTICS_LANGUAGES as readonly string[]).includes(code)
    ? (code as AnalyticsLanguage)
    : 'other';
}

export type AnalyticsEvents = {
  // Sign-up funnel
  signup_rules_opened: undefined;
  signup_step_viewed: { step: 1 | 2 | 3 };
  signup_failed: { reason: 'age_not_confirmed' | 'email_taken' | 'other' };
  signup_completed: { referred_circle: YesNo };

  // Email confirmation
  email_confirmed: { kind: 'signup' | 'change' };
  email_confirm_failed: { reason: EmailConfirmFailureReason };

  // Sign-in, passwords and account removal
  signin_succeeded: undefined;
  signin_failed: { reason: SigninFailureReason };
  password_reset_requested: undefined;
  password_reset_completed: undefined;
  password_reset_failed: { reason: PasswordResetFailureReason };
  account_removed: undefined;

  // Profile completion
  profile_section_saved: { section: ProfileSection };
  profile_save_failed: { section: ProfileSection; reason: SaveFailureReason };
  profile_viewed: { own: YesNo };

  // Offers: hosting and meeting
  offer_saved: {
    type: OfferType;
    action: 'create' | 'update';
    status?: 'yes' | 'maybe' | 'no';
  };
  offer_save_failed: { type: OfferType; reason: SaveFailureReason };
  offer_deleted: { type: OfferType };

  // Search and map
  search_place_selected: { source: 'suggestion' | 'query' };
  search_filter_changed: { filter: SearchFilter };
  search_no_results: { zoom: number; filters: number };
  search_offer_previewed: undefined;
  search_offer_not_found: undefined;
  search_community_note_opened: undefined;

  // Reaching out
  contact_request_sent: { source: OutreachSource };
  message_thread_opened: { unread: YesNo };
  message_gate_shown: { reason: MessageGateReason };
  message_sent:
    | {
        kind: 'first';
        via: 'editor' | 'quick_reply';
        source: OutreachSource;
      }
    | { kind: 'reply' | 'followup'; via: 'editor' | 'quick_reply' };
  message_send_failed: { reason: MessageSendFailureReason };

  // Circles
  circle_joined: { source: CircleSource };
  circle_left: { source: CircleSource };

  // Support
  support_request_sent: { signed_in: YesNo; category: SupportCategory };

  // Language
  language_switched: { language: AnalyticsLanguage; saved: YesNo };

  // Navigation
  navigation_clicked: { surface: NavigationSurface; item: NavigationItem };

  // Errors
  page_not_found: undefined;
  api_request_failed: {
    status: number;
    method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'other';
    area: string;
  };
  client_error: { kind: 'error' | 'unhandled_rejection' };
};

export type AnalyticsEventName = keyof AnalyticsEvents;

export type AnalyticsEventData = Record<string, string | number>;

/** Event data as call arguments: required when the event has data, absent when it has none. */
export type AnalyticsEventArgs<Name extends AnalyticsEventName> =
  AnalyticsEvents[Name] extends undefined ? [] : [data: AnalyticsEvents[Name]];

/**
 * One line per event, saying when it fires. The mapped type makes this list
 * exhaustive, so the catalogue has a runtime copy for tests and docs.
 */
export const ANALYTICS_EVENTS: {
  readonly [Name in AnalyticsEventName]: string;
} = {
  signup_rules_opened: 'The rules are opened from the signup form.',
  signup_step_viewed:
    'A signup step is shown to a signed-out visitor (1 account, 2 circles, 3 done).',
  signup_failed:
    'Signup is rejected: age not confirmed, email already taken, or anything else.',
  signup_completed:
    'An account is created; says whether the signup came from a circle link.',
  email_confirmed:
    'An email confirmation link succeeds; says whether it confirms a signup or an email change.',
  email_confirm_failed:
    'An email confirmation link fails: the link is invalid or expired, or anything else went wrong.',
  signin_succeeded: 'Sign-in succeeds.',
  signin_failed:
    'Sign-in is rejected: wrong credentials, a suspended account, the rate limit, or a server error.',
  password_reset_requested: 'A password reset email is requested.',
  password_reset_completed: 'A new password is saved from a reset link.',
  password_reset_failed:
    'Saving a new password from a reset link fails: the link is invalid or expired, the rate limit, or a server error.',
  account_removed: 'An account removal link is confirmed.',
  profile_section_saved: 'A profile editor section is saved.',
  profile_save_failed:
    'Saving a profile editor section fails; says whether the server rejected the data.',
  profile_viewed:
    'A profile loads, once per profile; says whether it is the own profile.',
  offer_saved: 'A hosting or meet offer is created or updated.',
  offer_save_failed:
    'Saving a hosting or meet offer fails; says whether the server rejected the data.',
  offer_deleted: 'A meet offer is deleted.',
  search_place_selected:
    'A place is picked in the search box, from a suggestion or a typed query.',
  search_filter_changed: 'A search filter is changed.',
  search_no_results:
    'The map area stops having any offers; carries the rounded zoom and the number of narrowing filters, never the place.',
  search_offer_previewed: 'An offer is opened from the search map.',
  search_offer_not_found: 'An offer link on the search map points nowhere.',
  search_community_note_opened:
    'A community note is opened, from the map or the search sidebar.',
  contact_request_sent:
    'A contact request is sent; says where reaching out started.',
  message_thread_opened:
    'A message thread loads; says whether it had unread messages.',
  message_gate_shown:
    'The thread hides the reply form because the member is not public or their profile is too short.',
  message_sent:
    'A message is sent: the first in a thread (with where reaching out started), a reply to the other member, or a follow-up to an unanswered own message.',
  message_send_failed:
    'Sending a message fails; says whether the rate limit stopped it.',
  circle_joined: 'A circle is joined; says from where.',
  circle_left: 'A circle is left; says from where.',
  support_request_sent:
    'The support form is sent; carries the category and whether the sender is signed in.',
  language_switched:
    'The interface language is switched; carries the locale code and whether it was saved to the account.',
  navigation_clicked: 'A link in the top navigation or the footer is used.',
  page_not_found: 'The not-found page is shown.',
  api_request_failed:
    'An API request fails unexpectedly; carries the status, method and first path segment.',
  client_error: 'An uncaught error or unhandled promise rejection happens.',
};
