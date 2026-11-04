/**
 * Turn a failed API request into the fixed `reason` of a `*_failed` event.
 * Only the HTTP status is read, never the message, so a reason can't carry
 * text from the server. A request without a response (offline, timed out)
 * has no status and falls into the catch-all value.
 */
import type {
  EmailConfirmFailureReason,
  MessageSendFailureReason,
  PasswordResetFailureReason,
  SaveFailureReason,
  SigninFailureReason,
} from '../shared/events.ts';

function responseStatus(error: unknown): number | undefined {
  const status = (error as { response?: { status?: unknown } } | null)?.response
    ?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * `POST /api/auth/signin` answers 400 for an unknown user or a wrong
 * password, 403 for a suspended member and 429 from the sign-in limiter.
 * Unconfirmed members can sign in, so there is no `unconfirmed`.
 */
export function signinFailureReason(error: unknown): SigninFailureReason {
  switch (responseStatus(error)) {
    case 400:
      return 'credentials';
    case 403:
      return 'suspended';
    case 429:
      return 'rate_limited';
    default:
      return 'server';
  }
}

/**
 * `POST /api/auth/confirm-email/:token` answers 400 for a token that is
 * unknown, already used or expired: one query, one message, so expired and
 * invalid links can't be told apart.
 */
export function emailConfirmFailureReason(
  error: unknown,
): EmailConfirmFailureReason {
  return responseStatus(error) === 400 ? 'invalid_link' : 'server';
}

/**
 * `POST /api/auth/reset/:token` answers 400 for a token that is unknown,
 * already used or expired (the form already checks the password length and
 * that both fields match) and 429 from the reset limiter.
 */
export function passwordResetFailureReason(
  error: unknown,
): PasswordResetFailureReason {
  switch (responseStatus(error)) {
    case 400:
      return 'invalid_link';
    case 429:
      return 'rate_limited';
    default:
      return 'server';
  }
}

/** Sending a message answers 429 when a member writes to too many people. */
export function messageSendFailureReason(
  error: unknown,
): MessageSendFailureReason {
  return responseStatus(error) === 429 ? 'rate_limited' : 'other';
}

/**
 * Profile and offer saves answer 400 when the server rejects the data; photo
 * uploads add 413 (too big) and 415 (unsupported type).
 */
export function saveFailureReason(error: unknown): SaveFailureReason {
  const status = responseStatus(error);
  return status === 400 || status === 413 || status === 415
    ? 'validation'
    : 'server';
}
