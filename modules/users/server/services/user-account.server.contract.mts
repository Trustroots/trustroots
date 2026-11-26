import type { Types } from 'mongoose';
import type { UserMessaging } from './user-messaging.server.contract.mts';

export interface CircleCountRecord {
  _id?: Types.ObjectId;
  slug?: string;
}

export type UpdateCircleCount = (
  id: Types.ObjectId | string,
  difference: number,
  returnUpdated: boolean,
  callback: (error: Error | null, circle?: CircleCountRecord | null) => void,
) => void;

export interface UserAccountServices extends UserMessaging {
  updateCircleCount: UpdateCircleCount;
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
  'clearMessageNotifications' | 'removeOwnedOffers' | 'updateCircleCount'
>;
