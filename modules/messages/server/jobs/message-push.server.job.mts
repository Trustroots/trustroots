import mongoose, { type Types } from 'mongoose';
import unifiedPush from '../../../users/server/services/unified-push.server.service.mts';
import userRolesService from '../../../core/server/services/user-roles.server.service.mts';
import type { MessageRecord } from '../models/message.server.model.mts';

export const messagePushJobName = 'send Android message notification';

interface MessagePushJobData {
  messageId: string;
}

export async function queueMessagePush(
  messageId: Types.ObjectId,
  recipientId: Types.ObjectId,
): Promise<void> {
  if (!(await unifiedPush.hasRegistrations(recipientId))) return;
  const { default: agenda } = await import('../../../../config/lib/agenda.mts');
  await agenda.schedule<MessagePushJobData>(new Date(), messagePushJobName, {
    messageId: String(messageId),
  });
}

export async function deliverMessagePush({
  messageId,
}: MessagePushJobData): Promise<void> {
  if (!unifiedPush.pushConfiguration().enabled) return;
  const message = await mongoose.model<MessageRecord>('Message').findOne({
    _id: messageId,
    created: { $gte: new Date(Date.now() - 5 * 60_000) },
    read: false,
    shadowHidden: { $ne: true },
  });
  if (!message?.userFrom || !message.userTo) return;

  const members = await mongoose
    .model<{
      roles: string[];
      blocked?: Types.ObjectId[];
    }>('User')
    .find(
      { _id: { $in: [message.userFrom, message.userTo] } },
      'roles blocked',
    );
  const sender = members.find(member => member._id.equals(message.userFrom));
  const recipient = members.find(member => member._id.equals(message.userTo));
  if (
    !sender ||
    !recipient ||
    userRolesService.hasRestrictedMessagingRole(sender) ||
    userRolesService.hasRestrictedMessagingRole(recipient) ||
    recipient.blocked?.some(member => member.equals(message.userFrom))
  )
    return;

  await unifiedPush.notifyUnread(message.userTo, message.userFrom);
}
