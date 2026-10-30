import _ from 'lodash';
import emailService from './../../../core/server/services/email.server.service.mjs';
import log from './../../../../config/lib/logger.mjs';
import config from './../../../../config/config.mts';
import moment from 'moment';
import userRolesService from './../../../users/server/services/user-roles.server.service.mjs';
import mongoose, { type Types } from 'mongoose';
import unifiedPush from './../../../users/server/services/unified-push.server.service.mjs';
import type { MessageRecord } from '../models/message.server.model.mts';

interface Reminder {
  order: number;
  timing: moment.DurationInputArg1;
}
interface ReminderMessage {
  [key: string]: unknown;
  id: Types.ObjectId;
  content: string;
  created: Date;
}
interface Notification {
  _id: { userTo: Types.ObjectId; userFrom: Types.ObjectId };
  total: number;
  messages: ReminderMessage[];
  notificationCount: number;
  dontSend?: boolean;
}
interface ReminderUser {
  _id: Types.ObjectId;
  email: string;
  displayName: string;
  username: string;
  roles: string[];
}
type Done<Results extends unknown[] = []> = {
  (error?: Error | null): void;
  (error: Error | null | undefined, ...results: Results): void;
};

const unifiedPushWithNotify = unifiedPush as {
  notifyUnread(userId: Types.ObjectId, senderId: Types.ObjectId): Promise<void>;
};

/**
 * Task that checks for unread messages from the DB and sends
 * notification emails for users who have unread messages.
 *
 * Won't notify for very fresh (10min) messages, or else
 * people would get email for each line of chat message somebody writes.
 *
 * Also if people are reading their messages (and thus messages get marked read),
 * notifications aren't sent.
 *
 * This whole task might be a bit memory intensive (aggregate specificly).
 *
 * Further notifications are sent if the message stays unread
 * and belongs to an unreplied thread.
 *
 * Timing of the notifications is configured in config/env/default.js
 * in property `limits.unreadMessageReminders`.
 *
 * The further notifications are not sent when too much time passed
 * since the last unread message was sent.
 * The time limit for further notifications is configured in config/env/default.js
 * in property `limits.unreadMessageRemindersTooLate`.
 *
 * Note: we use terms `notification` and `reminder` as synonyms here
 */

/**
 * Module dependencies.
 */
const Message = mongoose.model<MessageRecord>('Message');
const User = mongoose.model<ReminderUser>('User');
function run(_job: unknown, agendaDone: Done): void {
  // read timing of notifications from config
  // we expect an array of momentjs objects
  // i.e. [{ minutes: 10 }, { hours: 24 }]
  const remindersConfig = config.limits.unreadMessageReminders;

  // sort the config from the earliest to the latest
  const sortedConfig = _.sortBy(
    remindersConfig as moment.DurationInputArg1[],
    function (timeSinceMessage: moment.DurationInputArg1) {
      return moment.duration(timeSinceMessage).asMilliseconds();
    },
  );

  /*
   * we run the reminders from the last to the first.
   * that way we avoid duplicates when more reminders are pending
   * i.e. when notificationCount is 0 and 24 hours already passed (maybe due to some agenda outage)
   * we run the 2nd reminder first, the notificationCount is set to 2
   * and the 1st reminder is not sent at all
   *
   * otherwise both reminders would be sent at the same time o_O
   *
   * hopefully there is not much harm in sending just one reminder in total
   * this case shouldn't happen too often
   */
  const remappedConfig = _.reverse(
    sortedConfig.map(
      (value: moment.DurationInputArg1, index: number): Reminder => ({
        order: index,
        timing: value,
      }),
    ),
  );

  // for every config, send the appropriate notifications
  async function sendAll(): Promise<void> {
    for (const reminder of remappedConfig)
      await sendUnreadMessageReminders(reminder);
  }
  sendAll().then(() => agendaDone(), agendaDone);
}

/**
 * Send the reminders about unread messages to various services
 * @param {Object} reminder - configuration for nth reminder
 * @param {Object} reminder.timing - How much time must pass (since the last unread message) to send the nth reminder.
 * A time object as momentjs would expect it, i.e. { 'minutes': 10 }
 * @param {number} reminder.order - Order of the reminder. The reminder is nth.
 * We start counting from 0. i.e. 3rd reminder has reminder.order: 2
 */
async function sendUnreadMessageReminders(reminder: Reminder): Promise<void> {
  const timePassed = reminder.timing;
  const reminderOrder = reminder.order;
  // Wait until the newest pending message in each conversation has aged
  // past the delay so a burst of messages produces one reminder.
  // Has to be a JS Date object, not a Moment object
  const createdTimeAgo = moment()
    .subtract(moment.duration(timePassed))
    .toDate();

  // Find all the unread messages which fit the reminder config requirements
  const notifications = await Message.aggregate<Notification>([
    {
      $match: {
        read: false,
        // first reminder is sent when notificationCount is 0
        // second reminder is sent when notificationCount is 0 or 1
        // etc...
        notificationCount: {
          $lte: reminderOrder,
        },
      },
    },
    {
      $group: {
        // Group separate emails
        _id: {
          userTo: '$userTo',
          userFrom: '$userFrom',
        },
        latestCreated: {
          $max: '$created',
        },
        // Collect unread messages count
        total: {
          $sum: 1,
        },
        // Collect message contents
        messages: {
          $push: {
            id: '$_id',
            content: '$content',
            created: '$created',
          },
        },
        // did we already send some notifications for the last unseen message?
        // the last unseen message has the minimum notification count
        // we'll use the value to determine whether the notification is the first one, or not; to change wording of the reminder
        notificationCount: {
          $min: '$notificationCount',
        },
      },
    },
    {
      $match: {
        latestCreated: {
          $lt: createdTimeAgo,
        },
      },
    },
  ]);
  // we pick only notifications which already have count > 0
  // the first ones we want to send for sure, so we keep `notification.dontSend` undefined
  const furtherNotifications = _.filter(
    notifications,
    function (notification: Notification) {
      return notification.notificationCount > 0;
    },
  );

  for (const notification of furtherNotifications) {
    // count messages in the other direction
    const count = await Message.countDocuments({
      userFrom: notification._id.userTo,
      userTo: notification._id.userFrom,
    });
    const isThreadReplied = count > 0;

    // find out whether it is too late to send the further notification
    // we just wrap it to function for clearer organisation
    const isTooLate = (function () {
      const lastMessage = _.maxBy(
        notification.messages,
        function (msg: ReminderMessage) {
          return msg.created;
        },
      ) as ReminderMessage;
      const tooLate = config.limits.unreadMessageRemindersTooLate;
      const tooOld = moment().subtract(moment.duration(tooLate)).toDate();
      return lastMessage.created < tooOld;
    })();
    if (isThreadReplied || isTooLate) {
      notification.dontSend = true;
    }
  }
  let userIds: Types.ObjectId[] = [];

  // Collect all user ids from notifications
  notifications.forEach(function (notification) {
    userIds.push(notification._id.userTo, notification._id.userFrom);
  });

  // Make sure we don't have huge list of dublicate user ids
  // @link https://lodash.com/docs#uniq
  userIds = _.uniq(userIds);

  // Fetch email + displayName for all users involved
  // Remember to add these values also userNotFound object (see below)
  const collectedUsers: Record<string, ReminderUser> = {};
  if (userIds.length > 0) {
    const users = await User.find(
      {
        _id: {
          $in: userIds,
        },
      },
      [
        // Fields to get for each user:
        'email',
        'displayName',
        'username',
        'roles',
      ].join(' '),
    ).exec();
    users.forEach(function (user) {
      // @link https://lodash.com/docs/#set
      // _.set(object, path, value)
      _.set(collectedUsers, user._id.toString(), user);
    });
  }
  async function notify(notification: Notification): Promise<void> {
    const userTo = _.get(
      collectedUsers,
      notification._id.userTo.toString(),
      false,
    );
    const userFrom = _.get(
      collectedUsers,
      notification._id.userFrom.toString(),
      false,
    );

    // If we don't have info about these users, they've been removed.
    // Don't send notification mail in such case.
    // Message will still be marked as notified.
    if (!userFrom || !userTo) {
      throw new Error(
        'Could not find all users relevant for this message to notify about. #j93bvs',
      );
    }

    // Suppress reminders related to suspended/shadowbanned profiles.
    // We still increment notificationCount later to avoid retrying forever.
    if (
      userRolesService.hasRestrictedMessagingRole(userFrom) ||
      userRolesService.hasRestrictedMessagingRole(userTo)
    ) {
      return;
    }

    // Process email notifications
    //
    // finish early if we don't want to send it
    if (notification.dontSend === true) {
      return;
    }
    if (reminderOrder === 0 && notification.notificationCount === 0) {
      // Push is best effort. Keep the existing email callback independent.
      unifiedPushWithNotify
        .notifyUnread(userTo._id, userFrom._id)
        .catch((error: unknown) => {
          log('error', 'UnifiedPush unread-message delivery failed.', {
            error,
          });
        });
    }
    await new Promise<void>((resolve, reject) => {
      emailService.sendMessagesUnread(userFrom, userTo, notification, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  // Keep at most five deliveries in flight and continue after send failures.
  let nextNotification = 0;
  let queueError: unknown;
  async function worker(): Promise<void> {
    while (nextNotification < notifications.length) {
      const notification = notifications[nextNotification++];
      try {
        await notify(notification);
      } catch (error) {
        queueError ??= error;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(5, notifications.length) }, () => worker()),
  );
  if (queueError)
    log(
      'error',
      'Sending unread message notifications caused an error. #j38vax',
      { error: queueError },
    );
  if (!notifications.length) return;
  // Holds ids of messages to be set `notified:true`
  const messageIds: Types.ObjectId[] = [];

  // Collect message ids for updating documents to `notified:true` later
  for (let i = 0, len = notifications.length; i < len; i++) {
    /* istanbul ignore else */
    if (notifications[i].messages) {
      notifications[i].messages.forEach(function (message: ReminderMessage) {
        messageIds.push(message.id);
      });
    }
  }

  // No message ids (shouldn't happen, but just in case)
  if (!messageIds.length) {
    // Log the failure to send the notification
    log(
      'warn',
      'No messages to set notified. This probably should not happen. #hg38vs',
    );
    //
    return;
  }

  // Update messages using ids
  // The first reminder has position 0, so we want to set to 1
  // The second reminder has position 1, so we want to set to 2
  // TODO the messageCount is not strictly messageCount because this update allows setting 0 to 2 and sending just 1 notification.
  try {
    await Message.updateMany(
      {
        _id: {
          $in: messageIds,
        },
      },
      {
        $set: {
          notificationCount: reminderOrder + 1,
        },
      },
    );
  } catch (err) {
    log('error', 'Error while marking messages as notified. #9ehvbn', {
      error: err,
    });
    throw err;
  }
}

export { run };
export default run;
export { run as 'module.exports' };
