import mongoose, { type Types } from 'mongoose';
import config from '../../../../config/config.mts';
import moment from 'moment';
import { sendMessageDigest } from '../../../core/server/services/email.server.service.mts';
import userRoles from '../../../users/server/services/user-roles.server.service.mts';
import type { UserServerRecord } from '../../../users/server/models/user.server.types.mts';
import type { MessageRecord } from '../models/message.server.model.mts';

interface UnreadConversation {
  _id: Types.ObjectId;
  messages: Types.ObjectId[];
}

export async function queueMessageDigests(now = new Date()) {
  const memberFields = 'displayName username roles';
  const User = mongoose.model<UserServerRecord>('User');
  const Message = mongoose.model<MessageRecord>('Message');
  const today = moment.utc(now).startOf('day').toDate();
  const monday = moment.utc(now).startOf('isoWeek').toDate();
  const recipients = User.find(
    {
      $or: [
        {
          messageEmailFrequency: 'daily',
          dailyMessageDigestPeriod: { $ne: today },
        },
        {
          messageEmailFrequency: 'weekly',
          weeklyMessageDigestPeriod: { $ne: monday },
        },
      ],
    },
    memberFields + ' email messageEmailFrequency blocked',
  )
    .lean()
    .cursor();
  const minimumAge = Math.min(
    ...config.limits.unreadMessageReminders.map(interval =>
      moment.duration(interval).asMilliseconds(),
    ),
  );
  const cutoff = new Date(now.getTime() - minimumAge);
  const earliest = new Date(
    now.getTime() -
      moment
        .duration(config.limits.unreadMessageRemindersTooLate)
        .asMilliseconds(),
  );
  for await (const recipient of recipients) {
    if (!recipient.email || userRoles.hasRestrictedMessagingRole(recipient))
      continue;
    const frequency = recipient.messageEmailFrequency;
    if (frequency !== 'daily' && frequency !== 'weekly') continue;
    const period = frequency === 'daily' ? today : monday;
    const field =
      frequency === 'daily'
        ? 'dailyMessageDigestPeriod'
        : 'weeklyMessageDigestPeriod';
    const unread = await Message.aggregate<UnreadConversation>([
      {
        $match: {
          userTo: recipient._id,
          // Stryker disable next-line ArrayDeclaration: equivalent, a placeholder entry never matches a sender id
          userFrom: { $nin: recipient.blocked ?? [] },
          read: false,
          shadowHidden: { $ne: true },
          notificationCount: 0,
          created: { $gte: earliest, $lt: cutoff },
        },
      },
      { $group: { _id: '$userFrom', messages: { $push: '$_id' } } },
    ]);
    const senders = await User.find(
      {
        _id: { $in: unread.map(conversation => conversation._id) },
        roles: { $nin: userRoles.restrictedMessagingRoles },
      },
      memberFields,
    )
      .lean()
      .exec();
    const byId = new Map(senders.map(sender => [String(sender._id), sender]));
    const selected = unread.flatMap(conversation => {
      const sender = byId.get(String(conversation._id));
      return sender ? [{ conversation, sender }] : [];
    });
    if (!selected.length) continue;

    // One worker reserves this recipient's period, even if Agenda runs
    // overlap, and a delayed worker cannot move it back to an older period.
    const claim = {
      _id: recipient._id,
      messageEmailFrequency: frequency,
      email: recipient.email,
    };
    const reserved = await User.updateOne(
      { ...claim, [field]: { $not: { $gte: period } } },
      { $set: { [field]: period } },
    );
    if (!reserved.modifiedCount) continue;
    try {
      await new Promise<void>((resolve, reject) => {
        sendMessageDigest(
          recipient,
          frequency,
          selected.map(({ conversation, sender }) => ({
            username: sender.username,
            displayName: sender.displayName || sender.username,
            count: conversation.messages.length,
          })),
          error => (error ? reject(error) : resolve()),
        );
      });
    } catch (error) {
      await User.updateOne(
        { ...claim, [field]: period },
        { $unset: { [field]: 1 } },
      );
      throw error;
    }
    await Message.updateMany(
      {
        _id: {
          $in: selected.flatMap(({ conversation }) => conversation.messages),
        },
        notificationCount: 0,
      },
      {
        $set: {
          notificationCount: config.limits.unreadMessageReminders.length,
        },
      },
    );
  }
}
