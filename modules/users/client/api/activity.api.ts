import axios from '../../../core/client/api/http-client.js';

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

export interface AccountActivityEvent {
  eventType: AccountActivityEventType;
  createdAt: string;
}

export interface AccountActivityPage {
  events: AccountActivityEvent[];
  nextCursor: string | null;
}

export async function getAccountActivity(
  cursor?: string,
): Promise<AccountActivityPage> {
  const { data } = await axios.get('/api/users/activity', {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}
