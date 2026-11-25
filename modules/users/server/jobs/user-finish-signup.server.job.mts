import crypto from 'node:crypto';
import { setToken } from '../services/action-token.server.service.mts';
import emailService from './../../../core/server/services/email.server.service.mts';
import config from './../../../../config/config.mts';
import log from '@trustroots/logger';
import { subDays, subHours } from 'date-fns';
import mongoose from 'mongoose';
import type {
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';

interface AgendaJob {
  attrs: { _id?: { toString(): string } };
}

/**
 * Task that checks for users who didn't finish their signup process and thus
 * have `public:false` in their profile. The script sends 3 (configurable)
 * reminder emails to these users in 2 day intervals, starting 4h after signup.
 *
 * Ignores users with `suspended` or `shadowban` roles.
 *
 * Keeps count of reminder emails at user's model.
 */

/**
 * Module dependencies.
 */

const User = mongoose.model<UserServerRecord, UserServerModel>('User');
const run = function (
  job: AgendaJob,
  agendaDone: (error?: Error | null) => void,
) {
  async function remind(): Promise<void> {
    // Ignore very recently signed up users
    const createdTimeAgo = subHours(new Date(), 4);

    // Ignore very recently reminded users
    const remindedTimeAgo = subDays(new Date(), 2);
    const users = await User.find({
      public: false,
      emailTemporary: { $type: 'string', $ne: '' },
      created: {
        $lt: createdTimeAgo,
      },
      // Exclude users with restricted roles.
      roles: {
        $nin: ['suspended', 'shadowban'],
      },
    })
      .and([
        {
          $or: [
            {
              publicReminderCount: {
                $lt: config.limits.maxSignupReminders || 3,
              },
            },
            {
              publicReminderCount: {
                $exists: false,
              },
            },
          ],
        },
        {
          $or: [
            {
              publicReminderSent: {
                $lt: remindedTimeAgo,
              },
            },
            {
              publicReminderSent: {
                $exists: false,
              },
            },
          ],
        },
      ])
      .limit(config.limits.maxProcessSignupReminders || 50)
      .exec();
    for (const user of users) {
      const reminder = {
        displayName: user.displayName,
        emailTemporary: user.emailTemporary,
        created: user.created,
        publicReminderCount: user.publicReminderCount,
        emailToken: crypto.randomBytes(32).toString('hex'),
      };
      setToken(reminder, 'emailToken', reminder.emailToken);
      await new Promise<void>((resolve, reject) => {
        emailService.sendSignupEmailReminder(
          reminder,
          err => {
            if (err) reject(err);
            else resolve();
          },
          {
            userId: String(user._id),
            emailToken: reminder.emailToken,
            previousToken: user.emailToken,
            previousIssuedAt: user.emailTokenIssuedAt,
            previousExpires: user.emailTokenExpires,
          },
        );
      });
    }
  }
  function finish(err?: Error | null): void {
    if (err) {
      // Get job id from Agenda job attributes
      // Agenda stores Mongo `ObjectId` so turning that into a string here
      log('error', 'Failure in finish signup reminder background job.', {
        error: err,
        jobId: job.attrs._id!.toString(),
      });
    }
    return agendaDone(err);
  }
  remind().then(() => finish(), finish);
};
export default run;
