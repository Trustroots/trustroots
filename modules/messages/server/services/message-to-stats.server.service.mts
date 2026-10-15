import './../models/message.server.model.mjs';
import nodeProcess from 'node:process';
import config from './../../../../config/config.mjs';
import mongoose, { type Types } from 'mongoose';
import log from './../../../../config/lib/logger.mjs';
import statService, {
  type StatObject,
} from './../../../stats/server/services/stats.server.service.mts';
import textService from './../../../core/server/services/text.server.service.mjs';
import type { MessageRecord } from '../models/message.server.model.mts';

type Callback = (error?: unknown | null) => void;
type MessageStatsInput = {
  _id: Types.ObjectId;
  content: string;
  created: Date;
  userFrom: Types.ObjectId | { _id: Types.ObjectId };
  userTo: Types.ObjectId | { _id: Types.ObjectId };
  spam?: boolean;
};
type MessageStatsPoint = StatObject & {
  namespace: 'messages';
  counts: { sent: 1 };
  values: { timeToFirstReply?: number };
  tags: {
    spam: 'yes' | 'no' | 'unknown';
    position: 'first' | 'firstReply' | 'other';
    messageLengthType: 'short' | 'long';
  };
  meta: {
    messageId: string;
    userFrom: string;
    userTo: string;
    messageLength: number;
  };
  time: Date;
};

interface MessageToStatsService {
  save(message: MessageStatsInput, callback?: Callback): void;
  process(
    message: MessageStatsInput,
    callback: (error: unknown | null, point?: MessageStatsPoint) => void,
  ): void;
  send(point: MessageStatsPoint, callback: Callback): void;
}

const service: MessageToStatsService = { save, process, send };
const Message = mongoose.model<MessageRecord>('Message');
const INFLUXDB_DISABLED_ERROR_MESSAGE =
  'InfluxDB disabled. Not creating a point for message statistics.';

function save(message: MessageStatsInput, callback?: Callback): void {
  const completion: Callback = error => {
    if (
      error &&
      (error as { message?: unknown }).message !==
        INFLUXDB_DISABLED_ERROR_MESSAGE &&
      nodeProcess.env.NODE_ENV !== 'test'
    ) {
      // Keep the logger's legacy third-argument value unchanged at this boundary.
      (log as (level: string, message: string, error: unknown) => unknown)(
        'error',
        'Saving message stats failed.',
        error,
      );
    }
    if (typeof callback === 'function') return callback(error);
  };

  if (!config?.influxdb?.enabled) {
    completion(new Error(INFLUXDB_DISABLED_ERROR_MESSAGE));
    return;
  }
  service.process(message, (error, statObject) => {
    if (error) return completion(error);
    service.send(statObject!, completion);
  });
}

function process(
  message: MessageStatsInput,
  callback: (error: unknown | null, point?: MessageStatsPoint) => void,
): void {
  let isFirstMessage = false;
  let isFirstReply = false;
  const userFrom = getUserId(message.userFrom);
  const userTo = getUserId(message.userTo);

  Message.findOne({
    $or: [
      { userTo, userFrom },
      { userTo: userFrom, userFrom: userTo },
    ],
  })
    .sort({ created: 1 })
    .exec()
    .then(firstMessage => {
      if (!firstMessage) {
        throw new Error(
          'first message not found, but should have been already saved',
        );
      }
      const completeFirstMessage = firstMessage as MessageStatsInput;
      isFirstMessage = String(completeFirstMessage._id) === String(message._id);
      const canBeTheFirstReply =
        !isFirstMessage &&
        String(completeFirstMessage.userTo) === String(userFrom);
      if (!canBeTheFirstReply) {
        return { firstMessage: completeFirstMessage, firstReply: null };
      }
      return Message.findOne({
        userTo: completeFirstMessage.userFrom,
        userFrom: completeFirstMessage.userTo,
      })
        .sort({ created: 1 })
        .exec()
        .then(firstReply => ({
          firstMessage: completeFirstMessage,
          firstReply: firstReply as MessageStatsInput | null,
        }));
    })
    .then(
      ({ firstMessage, firstReply }) => {
        isFirstReply = Boolean(
          firstReply && String(firstReply._id) === String(message._id),
        );
        let replyTime: number | undefined;
        if (isFirstReply) {
          replyTime =
            firstReply!.created.getTime() - firstMessage.created.getTime();
        }

        const msgLen = textService.plainText(message.content, true).length;
        let position: MessageStatsPoint['tags']['position'];
        if (isFirstMessage) position = 'first';
        else if (isFirstReply) position = 'firstReply';
        else position = 'other';
        const msgLenType: MessageStatsPoint['tags']['messageLengthType'] =
          msgLen < config.limits.longMessageMinimumLength ? 'short' : 'long';
        let spam: MessageStatsPoint['tags']['spam'];
        if (message.spam === true) spam = 'yes';
        else if (message.spam === false) spam = 'no';
        else spam = 'unknown';

        const statObject: MessageStatsPoint = {
          namespace: 'messages',
          counts: { sent: 1 },
          values: {},
          tags: { spam, position, messageLengthType: msgLenType },
          meta: {
            messageId: String(message._id),
            userFrom: String(userFrom),
            userTo: String(userTo),
            messageLength: msgLen,
          },
          time: message.created,
        };
        if (isFirstReply) statObject.values.timeToFirstReply = replyTime;
        callback(null, statObject);
      },
      error => callback(error),
    );
}

function getUserId(
  user: Types.ObjectId | { _id: Types.ObjectId },
): Types.ObjectId {
  const populatedId = (user as { _id?: Types.ObjectId })._id;
  return populatedId ? populatedId : (user as Types.ObjectId);
}

function send(point: MessageStatsPoint, callback: Callback): void {
  statService.stat(point, callback as (error?: Error | null) => void);
}

const processExport = process;
const saveExport = save;
const sendExport = send;
export { processExport as process, saveExport as save, sendExport as send };
export default service;
export { service as 'module.exports' };
