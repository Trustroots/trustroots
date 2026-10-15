import { getAccountActivity } from '../../client/api/activity.api.js';
import type {
  AccountActivityEvent,
  AccountActivityEventType,
  AccountActivityPage,
} from '../../shared/account-activity.js';

async function checkAccountActivityClientApiContracts() {
  const page: AccountActivityPage = await getAccountActivity();
  const firstEvent: AccountActivityEvent | undefined = page.events[0];
  const validType: AccountActivityEventType = 'recovery_code_used';

  void page.nextCursor?.toUpperCase();
  void firstEvent?.createdAt;
  void validType;

  // @ts-expect-error Unknown event names must not cross the account activity API.
  const invalidType: AccountActivityEventType = 'unknown_event';
  // @ts-expect-error Event timestamps are required by the API contract.
  const missingTimestamp: AccountActivityEvent = {
    eventType: 'password_changed',
  };
  // @ts-expect-error The cursor is either an opaque string or null.
  const invalidPage: AccountActivityPage = { events: [], nextCursor: 42 };
  // @ts-expect-error Account activity cursors are strings.
  await getAccountActivity(42);

  return { invalidType, missingTimestamp, invalidPage };
}

void checkAccountActivityClientApiContracts;
