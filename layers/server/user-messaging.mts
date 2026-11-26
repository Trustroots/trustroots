import messages from '../../modules/messages/server/controllers/messages.server.controller.mts';
import messageStats from '../../modules/messages/server/services/message-stat.server.service.mts';
import { readWrittenMessages } from '../../modules/messages/server/services/member-messages.server.service.mts';
import type { UserMessaging } from '../../modules/users/server/services/user-messaging.server.contract.mts';

export const userMessaging = {
  clearMessageNotifications: (userId, callback) =>
    messages.markAllMessagesToUserNotified(userId, callback),
  readReplyStats: messageStats.readFormattedMessageStatsOfUser,
  readWrittenMessages,
} satisfies UserMessaging;
