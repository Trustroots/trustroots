import _ from 'lodash';
import emailService from './../../../core/server/services/email.server.service.mts';
import log from '@trustroots/logger';
import config from './../../../../config/config.mts';
import moment from 'moment';
import userRolesService from './../../../users/server/services/user-roles.server.service.mts';
import mongoose, { type Types } from 'mongoose';
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
  latestCreated: Date;
  total: number;
  messages: ReminderMessage[];
  notificationCount: number;
  dontSend?: boolean;
}
type MessageEmailFrequency =
  import('../../../users/shared/email-preferences.ts').MessageEmailFrequency;
interface ReminderUser {
  messageEmailFrequency?: MessageEmailFrequency;
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
  const pending = { read: false, notificationCount: { $lte: reminderOrder } };

  // Find all the unread messages which fit the reminder config requirements
  const notifications = await Message.aggregate<Notification>([
    {
      $match: pending,
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userTo',
        foreignField: '_id',
        as: 'recipient',
      },
    },
    {
      $match: {
        'recipient.messageEmailFrequency': { $nin: ['off', 'daily', 'weekly'] },
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
    { $sort: { latestCreated: 1, '_id.userTo': 1, '_id.userFrom': 1 } },
    { $limit: 100 },
    {
      // Fetch only a bounded preview after deciding which conversations are due.
      $lookup: {
        from: Message.collection.name,
        let: {
          recipient: '$_id.userTo',
          sender: '$_id.userFrom',
          latest: '$latestCreated',
        },
        pipeline: [
          {
            $match: {
              ...pending,
              $expr: {
                $and: [
                  { $eq: ['$userTo', '$$recipient'] },
                  { $eq: ['$userFrom', '$$sender'] },
                  { $lte: ['$created', '$$latest'] },
                ],
              },
            },
          },
          { $sort: { created: -1, _id: -1 } },
          { $limit: 20 },
          { $sort: { created: 1, _id: 1 } },
          { $project: { _id: 0, content: 1, created: 1, id: '$_id' } },
        ],
        as: 'messages',
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
      const tooLate = config.limits.unreadMessageRemindersTooLate;
      const tooOld = moment().subtract(moment.duration(tooLate)).toDate();
      return notification.latestCreated < tooOld;
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
        'messageEmailFrequency',
      ].join(' '),
    ).exec();
    users.forEach(function (user) {
      // @link https://lodash.com/docs/#set
      // _.set(object, path, value)
      _.set(collectedUsers, user._id.toString(), user);
    });
  }
  const immediateNotifications = notifications.filter(notification => {
    const frequency =
      collectedUsers[String(notification._id.userTo)]?.messageEmailFrequency;
    return !frequency || frequency === 'immediate';
  });
  async function notify(notification: Notification): Promise<void> {
    const userTo: ReminderUser | undefined = _.get(
      collectedUsers,
      notification._id.userTo.toString(),
    );
    const userFrom: ReminderUser | undefined = _.get(
      collectedUsers,
      notification._id.userFrom.toString(),
    );

    // If we don't have info about these users, they've been removed.
    // Don't send notification mail in such case.
    // Message will still be marked as notified.
    if (!userFrom || !userTo) {
      throw new Error(
        // Stryker disable next-line StringLiteral: the message only reaches the log, where metadata redaction keeps just the error name
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
    if (notification.dontSend === true || !notification.messages.length) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      emailService.sendMessagesUnread(userFrom, userTo, notification, err => {
        // Stryker disable next-line ConditionalExpression: rejecting with an undefined error leaves queueError unset, exactly like resolving
        if (err) reject(err);
        else resolve();
      });
    });
  }
  // Keep at most five deliveries in flight and continue after send failures.
  let nextNotification = 0;
  let queueError: unknown;
  async function worker(): Promise<void> {
    while (nextNotification < immediateNotifications.length) {
      const notification = immediateNotifications[nextNotification++];
      try {
        await notify(notification);
      } catch (error) {
        queueError ??= error;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(5, immediateNotifications.length) }, () =>
      worker(),
    ),
  );
  if (queueError)
    log(
      'error',
      'Sending unread message notifications caused an error. #j38vax',
      { error: queueError },
    );
  if (!immediateNotifications.length) return;
  // Update the full batches, including messages omitted from the email preview.
  const conversations = immediateNotifications
    .filter(notification => notification.messages.length > 0)
    .map(({ _id, latestCreated }) => ({
      ..._id,
      created: { $lte: latestCreated },
    }));

  // No message ids (shouldn't happen, but just in case)
  if (!conversations.length) {
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
        ...pending,
        $or: conversations,
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

/** @esmNamed */
export { run };
export default run;
