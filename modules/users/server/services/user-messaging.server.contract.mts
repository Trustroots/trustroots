import type { Types } from 'mongoose';

export interface WrittenMessage {
  _id?: unknown;
  created?: unknown;
  content?: unknown;
  read?: unknown;
  userTo?: unknown;
}

export interface UserMessaging {
  clearMessageNotifications(
    userId: Types.ObjectId,
    callback: (error: Error | null) => void,
  ): void;
  readReplyStats(
    userId: Types.ObjectId,
    now: number,
    callback: (
      error: Error | null,
      stats?: { replyRate: string; replyTime: string },
    ) => void,
  ): void;
  readWrittenMessages(
    userId: Types.ObjectId | string,
  ): Promise<WrittenMessage[]>;
}
