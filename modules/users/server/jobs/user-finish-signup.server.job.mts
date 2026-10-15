import crypto from 'node:crypto';
import { setEmailConfirmationToken } from '../services/email-confirmation.server.service.mts';
import _ from 'lodash';
import emailService from './../../../core/server/services/email.server.service.mjs';
import config from './../../../../config/config.mts';
import log from './../../../../config/lib/logger.mjs';
import async from 'async';
import moment from 'moment';
import mongoose from 'mongoose';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';

interface AgendaJob {
  attrs: { _id?: { toString(): string } };
}

type WaterfallCallback = (error?: Error | null, ...results: unknown[]) => void;

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
  async.waterfall(
    [
      // Find un-confirmed users
      function (done: WaterfallCallback) {
        // Ignore very recently signed up users
        const createdTimeAgo = moment().subtract(
          moment.duration({
            hours: 4,
          }),
        );

        // Ignore very recently reminded users
        const remindedTimeAgo = moment().subtract(
          moment.duration({
            days: 2,
          }),
        );
        User.find({
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
          .exec()
          .then(
            function (users: UserServerDocument[]) {
              done(null, users);
            },
            function (err: Error) {
              done(err);
            },
          );
      },
      // Send emails
      function (users: UserServerDocument[], done: WaterfallCallback) {
        // No users to send emails to
        if (!users.length) {
          return done();
        }
        async.eachSeries(
          users,
          function (
            user: UserServerDocument,
            callback: (error?: Error | null) => void,
          ) {
            const previousToken = user.emailToken;
            const previousEmail = user.emailTemporary;
            const previousIssuedAt = user.emailTokenIssuedAt;
            const previousExpires = user.emailTokenExpires;
            setEmailConfirmationToken(
              user,
              crypto.randomBytes(32).toString('hex'),
            );
            User.updateOne(
              {
                _id: user._id,
                public: false,
                emailTemporary: previousEmail,
                emailToken:
                  previousToken === undefined
                    ? { $exists: false }
                    : previousToken,
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
              function (
                saveErr: Error | null,
                result: { matchedCount: number },
              ) {
                if (saveErr) return callback(saveErr);
                if (result.matchedCount !== 1) return callback();
                emailService.sendSignupEmailReminder(
                  user,
                  function (err?: Error | null) {
                    if (err) {
                      return callback(err);
                    } else {
                      // Mark reminder sent and update the reminder count
                      User.findByIdAndUpdate(
                        user._id,
                        {
                          $set: {
                            publicReminderSent: new Date(),
                          },
                          // If the field does not exist, $inc creates the field
                          // and sets the field to the specified value.
                          $inc: {
                            publicReminderCount: 1,
                          },
                        },
                        function (err?: Error | null) {
                          callback(err);
                        },
                      );
                    }
                  },
                );
              },
            );
          },
          function (err?: Error | null) {
            done(err);
          },
        );
      },
    ],
    function (err: Error | null | undefined) {
      if (err) {
        // Get job id from Agenda job attributes
        // Agenda stores Mongo `ObjectId` so turning that into a string here
        log('error', 'Failure in finish signup reminder background job.', {
          error: err,
          jobId: _.get(job, 'attrs._id')!.toString(),
        });
      }
      return agendaDone(err);
    },
  );
};
export default defaultExport;
export { defaultExport as 'module.exports' };
