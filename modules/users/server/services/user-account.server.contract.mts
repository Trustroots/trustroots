import type { Types } from 'mongoose';
import type { UserMessaging } from './user-messaging.server.contract.mts';

export interface UserAccountServices extends UserMessaging {
  removeOwnedOffers(
    userId: Types.ObjectId,
    callback: (error: Error | null) => void,
  ): void;
  readOwnedOffers(
    userId: Types.ObjectId | string,
  ): Promise<Record<string, unknown>[]>;
}

export type UserAccountCleanup = Pick<
  UserAccountServices,
  'clearMessageNotifications' | 'removeOwnedOffers'
>;
