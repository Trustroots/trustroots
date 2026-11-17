import { createHmac, timingSafeEqual } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import config from '../../../../config/config.mts';
import type { UserServerRecord } from '../models/user.server.types.mts';
import type { MessageEmailFrequency } from '../../shared/email-preferences.ts';

const unsubscribePath = '/email/unsubscribe';
const tokenPattern = /^([a-f0-9]{24})\.(messages|hosting)\.([a-f0-9]{64})$/;
type EmailCategory = 'messages' | 'hosting';

export interface NotificationEmail {
  userId: string;
  category: EmailCategory;
  frequency?: MessageEmailFrequency;
}

function users() {
  return mongoose.model<UserServerRecord>('User');
}

function signature(userId: string, category: EmailCategory, email: string) {
  return createHmac('sha256', config.sessionSecret)
    .update(JSON.stringify(['email-unsubscribe', userId, category, email]))
    .digest('hex');
}

export function notificationEmail(
  user: { _id?: Types.ObjectId | string; email?: string },
  category: EmailCategory,
  frequency?: MessageEmailFrequency,
) {
  if (!user._id || !user.email) return {};
  const userId = String(user._id);
  const token = [
    userId,
    category,
    signature(userId, category, user.email),
  ].join('.');
  return {
    notificationEmail: { userId, category, frequency },
    unsubscribeUrl:
      (config.https ? 'https://' : 'http://') +
      config.domain +
      unsubscribePath +
      '/' +
      token,
  };
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
  const expected = signature(userId, category, user.email);
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

export { unsubscribePath, tokenPattern };
