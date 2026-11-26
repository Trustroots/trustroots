import type { Types } from 'mongoose';
import type { LoadExportContacts } from './user-contacts.server.contract.mts';
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
  loadExportContacts: LoadExportContacts;
  removeAllContacts(
    userId: Types.ObjectId,
    callback: (error?: Error | null) => void,
  ): void;
  removeOwnedOffers(
    userId: Types.ObjectId,
    callback: (error: Error | null) => void,
  ): void;
  findSearchConnectionIds(viewerId: Types.ObjectId): Promise<Types.ObjectId[]>;
  readWrittenExperiences(
    userId: Types.ObjectId | string,
  ): Promise<WrittenExperience[]>;
  readOwnedOffers(
    userId: Types.ObjectId | string,
  ): Promise<Record<string, unknown>[]>;
}

export interface WrittenExperience {
  _id?: unknown;
  created?: unknown;
  public?: unknown;
  interactions?: unknown;
  recommend?: unknown;
  feedbackPublic?: unknown;
  removedAt?: unknown;
  userTo?: unknown;
}

export type UserAccountCleanup = Pick<
  UserAccountServices,
  | 'clearMessageNotifications'
  | 'removeOwnedOffers'
  | 'removeAllContacts'
  | 'updateCircleCount'
>;
