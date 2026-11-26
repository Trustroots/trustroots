import { createHmac } from 'node:crypto';
import type { Types } from 'mongoose';
import config from '../../../../config/config.mts';
import type { MessageEmailFrequency } from '../../shared/email-preferences.mts';

export const unsubscribePath = '/email/unsubscribe';
export const tokenPattern =
  /^([a-f0-9]{24})\.(messages|hosting)\.([a-f0-9]{64})$/;
type EmailCategory = 'messages' | 'hosting';

export interface NotificationEmail {
  userId: string;
  category: EmailCategory;
  frequency?: MessageEmailFrequency;
}

export function unsubscribeSignature(
  userId: string,
  category: EmailCategory,
  email: string,
) {
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
    unsubscribeSignature(userId, category, user.email),
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
