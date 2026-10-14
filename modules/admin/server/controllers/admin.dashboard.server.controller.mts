import mongoose, { type Types } from 'mongoose';
import errorService from './../../../core/server/services/error.server.service.mjs';

const getErrorMessage: (error: unknown) => string | boolean =
  errorService.getErrorMessage;

interface MessengerCount {
  _id: Types.ObjectId | null;
  messageCount: number;
}

interface MessageRecord {
  _id: Types.ObjectId;
  created: Date;
  userFrom: Types.ObjectId | null;
}

interface MessengerRecord {
  _id: Types.ObjectId;
  username: string;
  displayName?: string;
}

interface ThreadVoteRecord {
  _id: Types.ObjectId;
  created?: Date;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  reference: 'no';
}

interface NegativeExperienceRecord {
  _id: Types.ObjectId;
  created?: Date;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  recommend: 'no';
  removedAt?: Date;
}

interface TopMessenger {
  messageCount: number;
  user: MessengerRecord | { _id: Types.ObjectId } | null;
}

interface DashboardPayload extends Record<string, object | string | boolean> {
  negativeExperiences: NegativeExperienceRecord[];
  threadVotes: ThreadVoteRecord[];
  topMessengers: TopMessenger[];
}

type DashboardResponseBody = DashboardPayload | { message: string | boolean };
interface DashboardResponse {
  status(code: number): DashboardResponse;
  send(body: DashboardResponseBody): unknown;
}

const Experience = mongoose.model<NegativeExperienceRecord>('Experience');
const Message = mongoose.model<MessageRecord>('Message');
const ReferenceThread = mongoose.model<ThreadVoteRecord>('ReferenceThread');
const User = mongoose.model<MessengerRecord>('User');
const TOP_MESSENGERS_LIMIT = 10;
const THREAD_VOTES_LIMIT = 10;
const NEGATIVE_EXPERIENCES_LIMIT = 10;

function dateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function getTopMessengers(): Promise<TopMessenger[]> {
  const messengerCounts: MessengerCount[] | null =
    await Message.aggregate<MessengerCount>([
      {
        $match: {
          created: { $gte: dateDaysAgo(7) },
          userFrom: { $ne: null },
        },
      },
      { $group: { _id: '$userFrom', messageCount: { $sum: 1 } } },
      { $sort: { messageCount: -1 } },
      { $limit: TOP_MESSENGERS_LIMIT },
    ]).exec();
  const userIds = (messengerCounts || []).map(({ _id }) => _id).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select('username displayName _id')
        .exec()
    : [];
  const usersById = users.reduce<Record<string, MessengerRecord>>(
    (result, user) => {
      result[user._id.toString()] = user;
      return result;
    },
    {},
  );
  return (messengerCounts || []).map(({ _id, messageCount }) => ({
    messageCount,
    user: _id ? usersById[_id.toString()] || { _id } : null,
  }));
}

async function getThreadVotes(): Promise<ThreadVoteRecord[]> {
  const threadVotes: ThreadVoteRecord[] | null = await ReferenceThread.find({
    reference: 'no',
  })
    .sort('-created')
    .limit(THREAD_VOTES_LIMIT)
    .populate({
      path: 'userFrom',
      select: 'username displayName _id',
      model: 'User',
    })
    .populate({
      path: 'userTo',
      select: 'username displayName _id',
      model: 'User',
    })
    .exec();
  return threadVotes || [];
}

async function getNegativeExperiences(): Promise<NegativeExperienceRecord[]> {
  const negativeExperiences: NegativeExperienceRecord[] | null =
    await Experience.find({
      recommend: 'no',
      removedAt: { $exists: false },
    })
      .sort('-created')
      .limit(NEGATIVE_EXPERIENCES_LIMIT)
      .populate({
        path: 'userFrom',
        select: 'username displayName _id',
        model: 'User',
      })
      .populate({
        path: 'userTo',
        select: 'username displayName _id',
        model: 'User',
      })
      .exec();
  return negativeExperiences || [];
}

export const getDashboard = async (
  _req: unknown,
  res: DashboardResponse,
): Promise<unknown> => {
  try {
    const [negativeExperiences, topMessengers, threadVotes] = await Promise.all(
      [getNegativeExperiences(), getTopMessengers(), getThreadVotes()],
    );
    res.send({
      negativeExperiences,
      threadVotes,
      topMessengers,
    });
  } catch (error) {
    return res.status(400).send({
      message: getErrorMessage(error),
    });
  }
};

const defaultInterop = { getDashboard };
export default defaultInterop;
export { defaultInterop as 'module.exports' };
