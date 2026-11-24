import mongoose, { type Types } from 'mongoose';
import moment from 'moment';
import config from '../../../../config/config.mts';
import emailService from '../../../core/server/services/email.server.service.mts';
import type {
  MessageThrottleAlertRecord,
  MessageThrottleReviewRecord,
  MessageThrottleWindow,
} from '../models/message-throttle-alert.server.model.mts';

const Alert = mongoose.model<MessageThrottleAlertRecord>(
  'MessageThrottleAlert',
);
const Review = mongoose.model<MessageThrottleReviewRecord>(
  'MessageThrottleReview',
);
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function notify(
  user: { _id: Types.ObjectId; username?: string },
  recipientCount: number,
  window: MessageThrottleWindow,
): Promise<void> {
  const now = new Date();
  const claim = new mongoose.Types.ObjectId();
  try {
    await Alert.findOneAndUpdate(
      { _id: user._id, nextAlertAt: { $lte: now } },
      { $set: { nextAlertAt: new Date(now.getTime() + COOLDOWN_MS), claim } },
      { upsert: true },
    );
  } catch (error) {
    // A live cooldown (including a concurrent winner) collides on the sender _id.
    if ((error as { code?: number }).code === 11000) return;
    throw error;
  }

  try {
    await Review.create({ _id: claim, sender: user._id, ...window });
    const origin = (config.https ? 'https://' : 'http://') + config.domain;
    await new Promise<void>((resolve, reject) => {
      emailService.renderEmailAndSend(
        'message-throttle-alert',
        {
          from: 'Trustroots Support <' + config.supportEmail + '>',
          email: config.supportEmail,
          subject: 'Member reached the messaging recipient limit',
          sparkpostCampaign: 'message-throttle-alert',
          username: user.username,
          adminProfileUrl: origin + '/admin/user?id=' + user._id,
          reviewUrl: origin + '/admin/support/message-reviews/' + claim,
          timestamp: window.windowEnd.toISOString(),
          recipientCount,
          limit: config.limits.messagesToIndividualsThrottle.count,
          windowMinutes: moment
            .duration(config.limits.messagesToIndividualsThrottle.duration)
            .asMinutes(),
        },
        error => (error ? reject(error) : resolve()),
      );
    });
  } catch (error) {
    // Never release a newer claim if this request was delayed past the cooldown.
    await Alert.deleteOne({ _id: user._id, claim });
    throw error;
  }
}

export default { notify };
