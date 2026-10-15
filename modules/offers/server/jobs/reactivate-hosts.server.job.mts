import emailService from './../../../core/server/services/email.server.service.mjs';
import config from './../../../../config/config.mjs';
import async from 'async';
import moment from 'moment';
import log from './../../../../config/lib/logger.mjs';
import mongoose, { type Types } from 'mongoose';
import type { OfferServerRecord } from '../models/offer.server.types.mts';

interface ReactivationUser {
  public: boolean;
  email: string;
  firstName: string;
  displayName: string;
}

interface ReactivationOffer {
  _id: Types.ObjectId;
  user: ReactivationUser | null;
}

interface OfferQuery {
  populate(path: string, fields: string): this;
  exec(
    callback: (
      error: Error | null,
      offers: ReactivationOffer[] | null | undefined,
    ) => void,
  ): void;
}

interface OfferModel {
  find(query: object): OfferQuery;
  findByIdAndUpdate(
    id: Types.ObjectId,
    update: object,
    callback: (error: Error | null) => void,
  ): void;
}

type Done = (error?: Error | null) => void;
type WaterfallDone<Result extends unknown[] = []> = {
  (error?: Error | null): void;
  (error: Error | null | undefined, ...results: Result): void;
};
type WaterfallTask = (...args: never[]) => void;
type AsyncCallbacks = {
  waterfall(
    tasks: WaterfallTask[],
    callback: (error?: Error | null, ...results: unknown[]) => void,
  ): void;
  eachSeries<Item>(
    items: Item[],
    iteratee: (item: Item, callback: Done) => void,
    callback: Done,
  ): void;
};
const asyncCallbacks = async as unknown as AsyncCallbacks;

/**
 * Task that checks for hosting offers that are set to "no" and were modified
 * longer than 3 months ago. Sends these users one reminder asking if they still
 * would like to keep their hosting status as "no".
 *
 * Keeps count of reminder emails at offer model.
 */

/**
 * Module dependencies.
 */
const Offer = mongoose.model<OfferServerRecord>(
  'Offer',
) as unknown as OfferModel;
function run(_job: unknown, agendaDone: Done): void {
  asyncCallbacks.waterfall(
    [
      // Find "no" hosting offers
      function (done: WaterfallDone<[ReactivationOffer[]]>) {
        // Ignore only offers modified within past X days
        // Has to be a JS Date object, not a Moment object
        const updatedTimeAgo = moment()
          .subtract(moment.duration(config.limits.timeToReactivateHosts))
          .toDate();
        Offer.find({
          type: 'host',
          status: 'no',
          updated: {
            $lt: updatedTimeAgo,
          },
          // Only offers we didn't notify yet
          reactivateReminderSent: {
            $exists: false,
          },
        })
          .populate('user', 'public email firstName displayName')
          .exec(function (err, offers) {
            done(err, offers || []);
          });
      },
      // Send emails
      function (offers: ReactivationOffer[], done: WaterfallDone) {
        // No users to send emails to
        if (!offers.length) {
          return done();
        }
        asyncCallbacks.eachSeries(
          offers,
          function (offer, callback) {
            emailService.sendReactivateHosts(
              offer.user as ReactivationUser,
              function (err: Error | null | undefined) {
                if (err) {
                  return callback(err);
                } else {
                  // Mark reactivation mail sent
                  Offer.findByIdAndUpdate(
                    offer._id,
                    {
                      $set: {
                        reactivateReminderSent: new Date(),
                      },
                    },
                    function (err) {
                      callback(err);
                    },
                  );
                }
              },
            );
          },
          function (err) {
            done(err);
          },
        );
      },
    ],
    function (err) {
      if (err) {
        // Preserve the original raw Error metadata passed through this logger boundary.
        log(
          'error',
          'Failure in reactivate hosts background job.',
          err as unknown as Record<string, unknown>,
        );
      }
      return agendaDone(err);
    },
  );
}
export { run };
export default run;
export { run as 'module.exports' };
