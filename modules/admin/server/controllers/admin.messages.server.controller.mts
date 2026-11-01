/** Module dependencies. */
import _ from 'lodash';
import crypto from 'crypto';
import mongoose, { type QueryFilter, type Types } from 'mongoose';
import errorService from './../../../core/server/services/error.server.service.mjs';
import type {
  ErrorBody,
  ValidationFailure,
} from './../../../core/server/services/error.server.service.mts';
import MessagesController from './../../../messages/server/controllers/messages.server.controller.mjs';
import { findPairRecords } from '../services/admin-pair-records.server.service.mts';
import textService from './../../../core/server/services/text.server.service.mts';

interface UserRecord {
  _id: Types.ObjectId | string;
  username: string;
  displayName?: string;
}

interface MessageRecord {
  _id: Types.ObjectId | string;
  created: Date;
  content: string;
  userFrom: Types.ObjectId | string;
  userTo: Types.ObjectId | string;
  read?: boolean;
  shadowHidden?: boolean;
}

interface ThreadRecord {
  _id?: Types.ObjectId | string;
  updated?: Date;
  userFrom?: Types.ObjectId | string;
  userTo?: Types.ObjectId | string;
  message?: Types.ObjectId | string;
  read?: boolean;
}

interface ReferenceThreadRecord {
  _id: Types.ObjectId | string;
  created?: Date;
  thread: Types.ObjectId | string;
  userFrom: Types.ObjectId | string;
  userTo: Types.ObjectId | string;
  reference: 'yes' | 'no';
}

interface AdminRequest {
  body?: Record<string, unknown>;
  user?: { _id: Types.ObjectId | string };
}

interface AdminResponse {
  status(code: number): AdminResponse;
  send(body: Record<string, unknown> | ErrorBody): unknown;
}

interface WarningError {
  statusCode?: unknown;
  message?: unknown;
}

type ObjectIdValidationInput = Parameters<
  typeof mongoose.Types.ObjectId.isValid
>[0];

const Message = mongoose.model<MessageRecord>('Message');
const Thread = mongoose.model<ThreadRecord>('Thread');
const ReferenceThread =
  mongoose.model<ReferenceThreadRecord>('ReferenceThread');
const User = mongoose.model<UserRecord>('User');

async function findScammerRecipients(
  username: unknown,
  currentUserId: unknown,
): Promise<{ scammer: UserRecord; recipients: UserRecord[] }> {
  if (typeof username !== 'string' || !username.trim()) {
    const error: WarningError = new Error('Missing `username` field.');
    error.statusCode = 400;
    throw error;
  }
  const scammer = await User.findOne({ username: username.trim() }).exec();
  if (!scammer) {
    const error: WarningError = new Error('Member does not exist.');
    error.statusCode = 404;
    throw error;
  }
  const recipientIds = await Message.distinct('userTo', {
    userFrom: scammer._id,
  }).exec();
  const recipients = await User.find({
    _id: {
      $in: recipientIds.filter(
        id => !currentUserId || String(id) !== String(currentUserId),
      ),
    },
  })
    .select('username displayName')
    .sort({ username: 1 })
    .exec();
  return { scammer, recipients };
}

function warningError(error: unknown): WarningError {
  return error as WarningError;
}

/** @esmNamed */
export const getScammerRecipients = async (
  req: AdminRequest,
  res: AdminResponse,
): Promise<unknown> => {
  try {
    const { scammer, recipients } = await findScammerRecipients(
      _.get(req, ['body', 'username']),
      req.user && req.user._id,
    );
    return res.send({
      scammer: {
        _id: scammer._id,
        username: scammer.username,
      },
      recipients,
    });
  } catch (error) {
    const failure = warningError(error);
    return res.status((failure.statusCode as number) || 400).send({
      message: failure.statusCode
        ? failure.message
        : errorService.getErrorMessage(error as ValidationFailure),
    });
  }
};

/** @esmNamed */
export const sendScammerWarning = async (
  req: AdminRequest,
  res: AdminResponse,
): Promise<unknown> => {
  const content: unknown = _.get(req, ['body', 'content']);
  const cleanContent: string = textService.html(_.toString(content));
  if (!cleanContent || textService.isEmpty(cleanContent)) {
    return res.status(400).send({ message: 'Please write a message.' });
  }
  try {
    const { scammer, recipients } = await findScammerRecipients(
      _.get(req, ['body', 'username']),
      req.user && req.user._id,
    );
    const requestId = _.get(req, ['body', 'requestId']);
    if (typeof requestId !== 'string' || !/^[a-f0-9]{32}$/.test(requestId)) {
      return res.status(400).send({
        message: 'A valid warning request ID is required.',
      });
    }
    // The primary key makes retries atomic even on a standalone MongoDB server.
    // Keep each recipient's original content, timestamp and read state on retry.
    const savedMessages = await Promise.all(
      recipients.map(recipient => {
        const requestUser = req.user!;
        const id = crypto
          .createHash('sha256')
          .update(
            JSON.stringify([
              String(requestUser._id),
              String(scammer._id),
              requestId,
              String(recipient._id),
            ]),
          )
          .digest('hex')
          .slice(0, 24);
        return Message.findOneAndUpdate(
          { _id: id },
          {
            $setOnInsert: {
              content: cleanContent,
              userFrom: requestUser._id,
              userTo: recipient._id,
              read: false,
              shadowHidden: false,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ).exec();
      }),
    );
    if (savedMessages.length) {
      const updates = savedMessages.flatMap(message => {
        const savedMessage = message!;
        const pair = {
          $or: [
            { userTo: savedMessage.userTo, userFrom: savedMessage.userFrom },
            { userTo: savedMessage.userFrom, userFrom: savedMessage.userTo },
          ],
        };
        const latest = {
          updated: savedMessage.created,
          userFrom: savedMessage.userFrom,
          userTo: savedMessage.userTo,
          message: savedMessage._id,
          read: savedMessage.read,
        };
        // Concurrent retries must also agree on the new thread's primary key.
        // Existing threads retain their IDs, including the reverse direction.
        const threadId = crypto
          .createHash('sha256')
          .update(
            JSON.stringify(
              [
                String(savedMessage.userFrom),
                String(savedMessage.userTo),
              ].sort(),
            ),
          )
          .digest('hex')
          .slice(0, 24);
        return [
          {
            updateOne: {
              filter: pair,
              update: { $setOnInsert: { ...latest, _id: threadId } },
              upsert: true,
            },
          },
          // Repair an older thread after a partial failure, without marking a
          // read warning unread again or replacing a newer conversation message.
          {
            updateOne: {
              filter: { ...pair, updated: { $lt: savedMessage.created } },
              update: { $set: latest },
            },
          },
        ];
      });
      try {
        await Thread.bulkWrite(updates, { ordered: false });
      } catch (error) {
        if (
          typeof error !== 'object' ||
          error === null ||
          !('code' in error) ||
          error.code !== 11000
        ) {
          throw error;
        }
        // Another request inserted a shared primary key. The unordered batch
        // has finished; retry against the now-existing threads to repair state.
        await Thread.bulkWrite(updates, { ordered: false });
      }
    }
    return res.send({
      scammer: { _id: scammer._id, username: scammer.username },
      sent: savedMessages.length,
    });
  } catch (error) {
    const failure = warningError(error);
    return res.status((failure.statusCode as number) || 400).send({
      message: failure.statusCode
        ? failure.message
        : errorService.getErrorMessage(error as ValidationFailure),
    });
  }
};

/**
 * This middleware sends a response with an array of found users.
 * @esmNamed
 */
export const getMessages = async (
  req: AdminRequest,
  res: AdminResponse,
): Promise<unknown> => {
  const user1: unknown = _.get(req, ['body', 'user1']);
  const user2: unknown = _.get(req, ['body', 'user2']);
  // Check that all provided IDs are valid.
  if (
    ![user1, user2].every(
      user =>
        !user ||
        mongoose.Types.ObjectId.isValid(user as ObjectIdValidationInput),
    )
  ) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }
  try {
    const messages = await findPairRecords<MessageRecord>(
      { find: filter => Message.find(filter as QueryFilter<MessageRecord>) },
      user1,
      user2,
    ).exec();
    const referenceThreads = await findPairRecords(
      {
        find: filter =>
          ReferenceThread.find(filter as QueryFilter<ReferenceThreadRecord>),
      },
      user1,
      user2,
    ).exec();
    return res.send({
      messages: MessagesController.sanitizeMessages(messages),
      referenceThreads: referenceThreads || [],
    });
  } catch (error) {
    return errorService.sendBadRequest(res, error as Error);
  }
};

const defaultInterop = {
  getScammerRecipients,
  sendScammerWarning,
  getMessages,
};
export default defaultInterop;
/** @commonjs */
export { defaultInterop as 'module.exports' };
