/** Event types exposed by the member account activity endpoint. */
export type AccountActivityEventType =
  | 'session_created'
  | 'session_revoked'
  | 'sessions_signed_out'
  | 'password_changed'
  | 'password_reset'
  | 'email_changed'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'recovery_codes_replaced'
  | 'recovery_code_used';

/** A public event in the member's account activity history. */
export interface AccountActivityEvent {
  eventType: AccountActivityEventType;
  createdAt: string;
}

/** One cursor-paginated response from the account activity endpoint. */
export interface AccountActivityPage {
  events: AccountActivityEvent[];
  nextCursor: string | null;
}
