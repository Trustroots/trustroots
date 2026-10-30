import emailService from './../../../core/server/services/email.server.service.mjs';
import config from './../../../../config/config.mts';
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
  exec(): Promise<ReactivationOffer[]>;
}

interface OfferModel {
  find(query: object): OfferQuery;
  findByIdAndUpdate(id: Types.ObjectId, update: object): Promise<unknown>;
}

type Done = (error?: Error | null) => void;

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
  async function reactivate(): Promise<void> {
    // Ignore only offers modified within past X days
    // Has to be a JS Date object, not a Moment object
    const updatedTimeAgo = moment()
      .subtract(moment.duration(config.limits.timeToReactivateHosts))
      .toDate();
    const offers = await Offer.find({
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
      .exec();
    for (const offer of offers) {
      await new Promise<void>((resolve, reject) => {
        emailService.sendReactivateHosts(
          offer.user as ReactivationUser,
          function (err: Error | null | undefined) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
        );
      });
      await Offer.findByIdAndUpdate(offer._id, {
        $set: { reactivateReminderSent: new Date() },
      });
    }
  }
  function finish(err?: Error | null): void {
    if (err) {
      // Preserve the original raw Error metadata passed through this logger boundary.
      log(
        'error',
        'Failure in reactivate hosts background job.',
        err as unknown as Record<string, unknown>,
      );
    }
    agendaDone(err);
  }
  reactivate().then(() => finish(), finish);
}
export { run };
export default run;
export { run as 'module.exports' };
