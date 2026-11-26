import { timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import type { UserServerRecord } from '../models/user.server.types.mts';
import {
  tokenPattern,
  unsubscribeSignature,
  type NotificationEmail,
} from '../../../core/server/services/notification-email-envelope.server.service.mts';

function users() {
  return mongoose.model<UserServerRecord>('User');
}

export async function canDeliverNotificationEmail(
  notification: NotificationEmail,
  email: string | undefined,
) {
  const user = await users()
    .findById(
      notification.userId,
      'email messageEmailFrequency hostingReminderEmails',
    )
    .lean()
    .exec();
  if (!email || !user || user.email !== email) return false;
  return notification.category === 'hosting'
    ? user.hostingReminderEmails !== false
    : (user.messageEmailFrequency ?? 'immediate') === notification.frequency;
}

export async function confirmUnsubscribe(token: string) {
  const parts = tokenPattern.exec(token);
  if (!parts) return false;
  const [, userId, categoryValue, hash] = parts;
  const category = categoryValue === 'hosting' ? 'hosting' : 'messages';
  const user = await users().findById(userId, 'email').lean().exec();
  if (!user?.email) return false;
  const expected = unsubscribeSignature(userId, category, user.email);
  if (
    !timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expected, 'hex'))
  ) {
    return false;
  }
  const fields =
    category === 'hosting'
      ? { hostingReminderEmails: false }
      : { messageEmailFrequency: 'off' };
  const result = await users().updateOne(
    { _id: userId, email: user.email },
    { $set: fields },
  );
  return result.matchedCount === 1;
}
