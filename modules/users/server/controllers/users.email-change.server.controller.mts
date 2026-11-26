import { randomBytes } from 'node:crypto';
import mongoose, { type QueryFilter } from 'mongoose';
import validator from 'validator';
import log from '@trustroots/logger';
import emailService from '../../../core/server/services/email.server.service.mts';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';
import { setEmailConfirmationToken } from '../services/email-confirmation.server.service.mts';
import mfaService from '../services/mfa.server.service.mjs';
import userProfile from './users.profile.server.controller.mts';

const User = mongoose.model<UserServerRecord, UserServerModel>('User');
const invalidCredentials = {
  message: 'Password or authenticator confirmation failed.',
};
const staleCancellation = {
  message:
    'This email change is no longer pending. Refresh the page to check your account.',
};

interface EmailChangeRequest {
  user?: UserServerDocument;
  body?: Record<string, unknown>;
}

interface EmailChangeResponse {
  set(field: string, value: string): EmailChangeResponse;
  status(status: number): EmailChangeResponse;
  json(payload: unknown): unknown;
}

function versionQuery(authVersion: number): QueryFilter<UserServerRecord> {
  return authVersion === 0
    ? { $or: [{ authVersion: { $exists: false } }, { authVersion: 0 }] }
    : { authVersion };
}

export async function cancelPendingEmail(
  member: UserServerDocument,
  newEmail: string,
) {
  if (!member.emailToken || member.emailTemporary !== newEmail) return null;
  return User.findOneAndUpdate(
    {
      _id: member._id,
      public: true,
      emailTemporary: newEmail,
      emailToken: member.emailToken,
      ...versionQuery(member.authVersion ?? 0),
    },
    {
      $unset: {
        emailTemporary: 1,
        emailToken: 1,
        emailTokenIssuedAt: 1,
        emailTokenExpires: 1,
      },
    },
    { returnDocument: 'after' },
  ).exec();
}

export async function stage(req: EmailChangeRequest, res: EmailChangeResponse) {
  res.set('Cache-Control', 'no-store');
  const member = req.user;
  if (!member) return res.status(403).json({ message: 'Please sign in.' });
  const { email, currentPassword, mfaCode } = req.body ?? {};
  const newEmail =
    typeof email === 'string' ? email.trim().toLowerCase() : null;
  if (newEmail === null || !validator.isEmail(newEmail)) {
    return res
      .status(400)
      .json({ message: 'Please enter a valid email address.' });
  }
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json(invalidCredentials);
  }
  const authVersion = member.authVersion ?? 0;
  try {
    const user = await User.findById(member._id).exec();
    if (!user || user.public !== true || user.roles.includes('suspended')) {
      return res.status(400).json({
        message: 'Confirm your current email address before changing it.',
      });
    }
    if (
      (user.authVersion ?? 0) !== authVersion ||
      !(await user.authenticate(currentPassword))
    ) {
      return res.status(400).json(invalidCredentials);
    }
    if (newEmail === user.email.toLowerCase()) {
      return res
        .status(400)
        .json({ message: 'Enter a different email address.' });
    }
    if (
      await User.exists({
        _id: { $ne: user._id },
        $or: [{ email: newEmail }, { emailTemporary: newEmail }],
      })
    ) {
      return res.status(403).json({
        message: 'This email is already in use. Please use another one.',
      });
    }
    if (
      user.mfaEnabled === true &&
      !(await mfaService.verifyAndConsume(
        user._id,
        mfaCode,
        Date.now(),
        authVersion,
      ))
    ) {
      return res.status(400).json(invalidCredentials);
    }

    const token = randomBytes(32).toString('hex');
    const pending: Pick<
      UserServerRecord,
      'emailToken' | 'emailTokenIssuedAt' | 'emailTokenExpires'
    > & { $locals?: { actionTokens?: Record<string, string> } } = {};
    const issuedAt = new Date();
    setEmailConfirmationToken(pending, token, issuedAt);

    // The resend endpoint must not see this token before the security notice
    // is queued to the current address.
    await new Promise<void>((resolve, reject) =>
      emailService.sendEmailChangeNotification(user, issuedAt, failure =>
        failure ? reject(failure) : resolve(),
      ),
    );
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        public: true,
        roles: { $nin: ['suspended'] },
        email: user.email,
        ...versionQuery(authVersion),
      },
      {
        $set: {
          emailTemporary: newEmail,
          emailToken: pending.emailToken,
          emailTokenIssuedAt: pending.emailTokenIssuedAt,
          emailTokenExpires: pending.emailTokenExpires,
          updated: new Date(),
        },
      },
      { returnDocument: 'after', runValidators: true },
    ).exec();
    if (!updated) return res.status(400).json(invalidCredentials);
    setEmailConfirmationToken(updated, token, issuedAt);
    try {
      await new Promise<void>((resolve, reject) =>
        emailService.sendChangeEmailConfirmation(updated, failure =>
          failure ? reject(failure) : resolve(),
        ),
      );
    } catch (error) {
      // A failed queue operation must not leave this link active. A newer
      // request may have replaced it, even for the same proposed address.
      await cancelPendingEmail(updated, newEmail);
      throw error;
    }
    return res.json(userProfile.sanitizeOwnProfile(updated));
  } catch {
    log('error', 'Could not stage account email change.');
    return res.status(503).json({
      message: 'Could not send email change confirmation. Please try again.',
    });
  }
}

export async function cancel(
  req: EmailChangeRequest,
  res: EmailChangeResponse,
) {
  res.set('Cache-Control', 'no-store');
  const member = req.user;
  if (!member) return res.status(403).json({ message: 'Please sign in.' });
  const newEmail = req.body?.newEmail;
  if (typeof newEmail !== 'string' || !newEmail) {
    return res
      .status(400)
      .json({ message: 'A pending email address is required.' });
  }
  try {
    const updated = await cancelPendingEmail(member, newEmail);
    if (!updated) return res.status(409).json(staleCancellation);
    return res.json({
      ...userProfile.sanitizeOwnProfile(updated),
      emailTemporary: null,
    });
  } catch {
    return res.status(500).json({
      message: 'Unable to cancel the email change. Please try again.',
    });
  }
}
