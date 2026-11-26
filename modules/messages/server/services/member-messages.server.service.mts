import mongoose, { type Types } from 'mongoose';
import type { MessageRecord } from '../models/message.server.model.mts';

export async function readWrittenMessages(userId: Types.ObjectId | string) {
  const Message = mongoose.model<MessageRecord>('Message');
  return Message.find({ userFrom: userId })
    .sort({ created: 1 })
    .populate('userTo', 'username displayName')
    .lean();
}
