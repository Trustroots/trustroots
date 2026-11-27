import axios from '@trustroots/core/http-client';
import type { AccountActivityPage } from '../../shared/account-activity.js';

export type {
  AccountActivityEvent,
  AccountActivityEventType,
  AccountActivityPage,
} from '../../shared/account-activity.js';

export async function getAccountActivity(
  cursor?: string,
): Promise<AccountActivityPage> {
  const { data } = await axios.get<AccountActivityPage>('/api/users/activity', {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}
