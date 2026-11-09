import mongoose, { type HydratedDocument, type Types } from 'mongoose';
import _ from 'lodash';
import moment from 'moment';
import type { MessageRecord } from '../models/message.server.model.mts';
import type { MessageStatRecord } from '../models/message-stat.server.model.mts';

type Callback<Result> = (error: Error | null, result?: Result) => void;
type CompleteMessage = MessageRecord & {
  content: string;
  created: Date;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
};
type MessageStatInput = Pick<CompleteMessage, 'userFrom' | 'userTo'>;
type CompleteMessageStat = HydratedDocument<
  MessageStatRecord & {
    firstMessageUserFrom: Types.ObjectId;
    firstMessageUserTo: Types.ObjectId;
    firstMessageCreated: Date;
  }
>;
type PopulatedMessageStat = Omit<
  CompleteMessageStat,
  'firstMessageUserFrom'
> & {
  firstMessageUserFrom: { _id: Types.ObjectId; roles: string[] } | null;
};
type ReplyStats = { replyRate: number | null; replyTime: number | null };
type FormattedStats = { replyRate: string; replyTime: string };
type StatResult = 'first' | 'firstReply' | 'other';

interface MessageStatService {
  updateMessageStat(
    message: MessageStatInput,
    callback: Callback<StatResult>,
  ): void;
  readMessageStatsOfUser(
    userId: Types.ObjectId,
    timeNow: number,
    callback: Callback<ReplyStats>,
  ): void;
  formatStats(stats: ReplyStats): FormattedStats;
  readFormattedMessageStatsOfUser(
    userId: Types.ObjectId,
    timeNow: number,
    callback: Callback<FormattedStats>,
  ): void;
}

const service: MessageStatService = {
  updateMessageStat,
  readMessageStatsOfUser,
  formatStats,
  readFormattedMessageStatsOfUser,
};

const Message = mongoose.model<MessageRecord>('Message');
const MessageStat = mongoose.model<MessageStatRecord>('MessageStat');

function createMessageStat(
  message: CompleteMessage,
): Promise<HydratedDocument<MessageStatRecord>> {
  const messageStat = new MessageStat({
    firstMessageUserFrom: message.userFrom,
    firstMessageUserTo: message.userTo,
    firstMessageCreated: message.created,
    firstMessageLength: message.content.length,
  });
  return messageStat.save();
}

function addFirstReplyInfo(
  messageStat: CompleteMessageStat,
  message: CompleteMessage,
): Promise<unknown> {
  return MessageStat.findOneAndUpdate(
    {
      firstMessageUserFrom: message.userTo,
      firstMessageUserTo: message.userFrom,
      firstReplyCreated: null,
    },
    {
      $set: {
        firstReplyCreated: message.created,
        firstReplyLength: message.content.length,
        timeToFirstReply:
          message.created.getTime() - messageStat.firstMessageCreated.getTime(),
      },
    },
  ).exec();
}

function updateMessageStat(
  message: MessageStatInput,
  callback: Callback<StatResult>,
): void {
  const query = {
    $or: [
      {
        firstMessageUserFrom: message.userFrom,
        firstMessageUserTo: message.userTo,
      },
      {
        firstMessageUserFrom: message.userTo,
        firstMessageUserTo: message.userFrom,
      },
    ],
  };

  MessageStat.findOne(query)
    .exec()
    .then(async messageStat => {
      if (messageStat) {
        if (messageStat.timeToFirstReply) return 'other';
        return findMessagesUpdateMessageStat(
          messageStat as CompleteMessageStat,
        );
      }
      return findMessagesCreateMessageStat();
    })
    .then(
      result => callback(null, result),
      error => callback(error as Error),
    );

  function findMessagesCreateMessageStat(): Promise<StatResult> {
    return Message.findOne({
      $or: [
        { userFrom: message.userFrom, userTo: message.userTo },
        { userFrom: message.userTo, userTo: message.userFrom },
      ],
    })
      .sort({ created: 1 })
      .exec()
      .then(firstMessage => {
        if (!firstMessage) throw new Error('The Thread is Empty');
        return createMessageStat(firstMessage as CompleteMessage);
      })
      .then(messageStat =>
        findMessagesUpdateMessageStat(messageStat as CompleteMessageStat),
      )
      .then(response => (response === 'other' ? 'first' : response));
  }

  function findMessagesUpdateMessageStat(
    messageStat: CompleteMessageStat,
  ): Promise<StatResult> {
    return Message.findOne({
      userFrom: messageStat.firstMessageUserTo,
      userTo: messageStat.firstMessageUserFrom,
    })
      .sort({ created: 1 })
      .exec()
      .then(firstReply => {
        if (!firstReply) return 'other';
        return addFirstReplyInfo(
          messageStat,
          firstReply as CompleteMessage,
        ).then(() => 'firstReply' as const);
      });
  }
}

function readMessageStatsOfUser(
  userId: Types.ObjectId,
  timeNow: number,
  callback: Callback<ReplyStats>,
): void {
  const DAY = 24 * 3600 * 1000;
  // Stryker disable next-line StringLiteral: an empty field selection populates the whole user, which still has _id and roles, so results are identical
  const senderFields = '_id roles';
  MessageStat.find({
    firstMessageUserTo: userId,
    firstMessageCreated: {
      $lte: new Date(timeNow),
      $gt: new Date(timeNow - 90 * DAY),
    },
  })
    .sort({ firstMessageCreated: -1 })
    .populate('firstMessageUserFrom', senderFields)
    .exec()
    .then(
      messageStats => {
        // Populated model fields are narrowed at this Mongoose populate boundary.
        const populatedStats =
          messageStats as unknown as PopulatedMessageStat[];
        const eligibleStats = populatedStats.filter(
          stat =>
            stat.firstMessageUserFrom &&
            !stat.firstMessageUserFrom.roles.includes('welcome-team'),
        );

        const chosenStats = (function (stats: PopulatedMessageStat[]) {
          // Stryker disable next-line EqualityOperator: with exactly ten stats both the first-ten and the 30-day branch return all ten
          if (stats.length < 10) return stats;
          if (stats[9].firstMessageCreated.getTime() < timeNow - 30 * DAY) {
            return stats.splice(0, 10);
          }
          return stats.filter(
            stat => stat.firstMessageCreated.getTime() >= timeNow - 30 * DAY,
          );
        })(eligibleStats);

        let repliedCount = 0;
        let replyTimeCumulated = 0;
        for (const stat of chosenStats) {
          if (typeof stat.timeToFirstReply === 'number') {
            ++repliedCount;
            replyTimeCumulated += stat.timeToFirstReply;
          }
        }
        const allCount = chosenStats.length;
        let replyRate: number | null;
        let replyTime: number | null;
        if (allCount < 3) {
          replyRate = null;
          replyTime = null;
        } else if (repliedCount === 0) {
          replyRate = 0;
          replyTime = null;
        } else {
          replyRate = repliedCount / allCount;
          replyTime = replyTimeCumulated / repliedCount;
        }
        callback(null, { replyRate, replyTime });
      },
      error => callback(error as Error),
    );
}

function isFiniteNumber(value: unknown): value is number {
  return _.isFinite(value);
}

function formatStats(stats: ReplyStats): FormattedStats {
  const replyRate = isFiniteNumber(stats.replyRate)
    ? Math.round(stats.replyRate * 100) + '%'
    : '';
  const replyTime = isFiniteNumber(stats.replyTime)
    ? moment.duration(stats.replyTime).humanize()
    : '';
  return { replyRate, replyTime };
}

function readFormattedMessageStatsOfUser(
  userId: Types.ObjectId,
  timeNow: number,
  callback: Callback<FormattedStats>,
): void {
  service.readMessageStatsOfUser(userId, timeNow, (error, stats) => {
    if (error) return callback(error);
    callback(null, service.formatStats(stats!));
  });
}

const formatStatsExport = formatStats;
const readFormattedMessageStatsOfUserExport = readFormattedMessageStatsOfUser;
const readMessageStatsOfUserExport = readMessageStatsOfUser;
const updateMessageStatExport = updateMessageStat;
export {
  formatStatsExport as formatStats,
  readFormattedMessageStatsOfUserExport as readFormattedMessageStatsOfUser,
  readMessageStatsOfUserExport as readMessageStatsOfUser,
  updateMessageStatExport as updateMessageStat,
};
export default service;
