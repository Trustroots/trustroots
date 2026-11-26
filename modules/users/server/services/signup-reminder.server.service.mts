import mongoose from 'mongoose';
import type { UserServerRecord } from '../models/user.server.types.mts';

import type { SignupReminder } from '../../../core/server/services/signup-reminder-mail.server.contract.mts';

// Reminders are two days apart. Allow another day for the worker to run
// before the previous reminder link expires.
const reminderLinkLifetimeMs = 3 * 24 * 60 * 60 * 1000;

export async function deliverSignupReminder(
  reminder: SignupReminder,
  email: string | undefined,
  send: () => Promise<void>,
): Promise<void> {
  if (!email) return;

  const User = mongoose.model<UserServerRecord>('User');
  const missing = { $exists: false };
  const pendingSignup = {
    _id: reminder.userId,
    public: false,
    roles: { $nin: ['suspended', 'shadowban'] },
    emailTemporary: email,
    emailToken:
      reminder.previousToken === undefined ? missing : reminder.previousToken,
    emailTokenIssuedAt:
      reminder.previousIssuedAt === undefined
        ? missing
        : reminder.previousIssuedAt,
    emailTokenExpires:
      reminder.previousExpires === undefined
        ? missing
        : reminder.previousExpires,
  };

  if (!(await User.exists(pendingSignup))) return;
  await send();

  const sentAt = new Date();
  // A resend, email change or confirmation while SMTP was in flight wins.
  await User.updateOne(pendingSignup, {
    $set: {
      emailToken: reminder.emailToken,
      emailTokenIssuedAt: sentAt,
      emailTokenExpires: new Date(sentAt.getTime() + reminderLinkLifetimeMs),
      publicReminderSent: sentAt,
    },
    $inc: { publicReminderCount: 1 },
  });
}
