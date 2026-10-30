import crypto from 'node:crypto';
import { setEmailConfirmationToken } from '../services/email-confirmation.server.service.mts';
import _ from 'lodash';
import emailService from './../../../core/server/services/email.server.service.mjs';
import config from './../../../../config/config.mts';
import log from './../../../../config/lib/logger.mjs';
import moment from 'moment';
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
const defaultExport = function (
  job: AgendaJob,
  agendaDone: (error?: Error | null) => void,
) {
  async function remind(): Promise<void> {
    // Ignore very recently signed up users
    const createdTimeAgo = moment()
      .subtract(moment.duration({ hours: 4 }))
      .toDate();

    // Ignore very recently reminded users
    const remindedTimeAgo = moment()
      .subtract(moment.duration({ days: 2 }))
      .toDate();
    const users = await User.find({
      public: false,
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
      const previousToken = user.emailToken;
      const previousEmail = user.emailTemporary;
      const previousIssuedAt = user.emailTokenIssuedAt;
      const previousExpires = user.emailTokenExpires;
      setEmailConfirmationToken(user, crypto.randomBytes(32).toString('hex'));
      const result = await User.updateOne(
        {
          _id: user._id,
          public: false,
          emailTemporary: previousEmail,
          emailToken:
            previousToken === undefined ? { $exists: false } : previousToken,
          emailTokenIssuedAt:
            previousIssuedAt === undefined
              ? { $exists: false }
              : previousIssuedAt,
          emailTokenExpires:
            previousExpires === undefined
              ? { $exists: false }
              : previousExpires,
        },
        {
          $set: {
            emailToken: user.emailToken,
            emailTokenIssuedAt: user.emailTokenIssuedAt,
            emailTokenExpires: user.emailTokenExpires,
          },
        },
      );
      if (result.matchedCount !== 1) continue;
      await new Promise<void>((resolve, reject) => {
        emailService.sendSignupEmailReminder(user, err => {
          if (err) reject(err);
          else resolve();
        });
      });
      // Mark reminder sent and update the reminder count
      await User.findByIdAndUpdate(user._id, {
        $set: {
          publicReminderSent: new Date(),
        },
        // If the field does not exist, $inc creates the field
        // and sets the field to the specified value.
        $inc: {
          publicReminderCount: 1,
        },
      });
    }
  }
  function finish(err?: Error | null): void {
    if (err) {
      // Get job id from Agenda job attributes
      // Agenda stores Mongo `ObjectId` so turning that into a string here
      log('error', 'Failure in finish signup reminder background job.', {
        error: err,
        jobId: _.get(job, 'attrs._id')!.toString(),
      });
    }
    return agendaDone(err);
  }
  remind().then(() => finish(), finish);
};
export default defaultExport;
export { defaultExport as 'module.exports' };
