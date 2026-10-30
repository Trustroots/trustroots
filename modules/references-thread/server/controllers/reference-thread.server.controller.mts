import mongoose, { type HydratedDocument, type Types } from 'mongoose';
import errorService from './../../../core/server/services/error.server.service.mjs';
import statService from './../../../stats/server/services/stats.server.service.mts';
import log from './../../../../config/lib/logger.mjs';
import type { ReferenceThreadRecord } from '../models/reference-thread.server.model.mts';

interface ReferenceUser {
  _id: Types.ObjectId;
  public?: boolean;
  gender?: string;
}

interface ReferenceRequest {
  body: { userTo?: unknown; reference?: unknown; [key: string]: unknown };
  user?: ReferenceUser;
  referenceThread?: ReferenceThreadDocument;
}

interface ReferenceResponse {
  status(code: number): ReferenceResponse;
  send(body: ReferenceResponseBody): ReferenceResponse;
  json(body: ReferenceResponseBody): ReferenceResponse;
}
type ReferenceThreadDocument = HydratedDocument<ReferenceThreadRecord>;
type ReferenceResponseBody =
  | ReferenceThreadDocument
  | { message: string; allowCreatingReference?: boolean }
  | Record<string, never>;
type ObjectIdInput = Parameters<typeof mongoose.Types.ObjectId.isValid>[0];

type ReferenceNext = (error?: unknown) => unknown;
type ReferenceController = {
  createReferenceThread: (
    req: ReferenceRequest,
    res: ReferenceResponse,
  ) => unknown;
  readReferenceThread: (
    req: ReferenceRequest,
    res: ReferenceResponse,
  ) => unknown;
  readReferenceThreadById: (
    req: ReferenceRequest,
    res: ReferenceResponse,
    next: ReferenceNext,
    userToId?: string,
  ) => unknown;
};

const service = {} as ReferenceController;

/**
 * Module dependencies.
 */
const Message = mongoose.model<{
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
}>('Message');
const Thread = mongoose.model<{
  _id: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
}>('Thread');
const User = mongoose.model<ReferenceUser>('User');
const ReferenceThread =
  mongoose.model<ReferenceThreadRecord>('ReferenceThread');

function isValidObjectId(value: unknown): value is ObjectIdInput {
  return mongoose.Types.ObjectId.isValid(value as ObjectIdInput);
}

function sendBadRequest(res: ReferenceResponse, error: unknown) {
  // The legacy error service accepts raw rejection values; keep them unchanged.
  return errorService.sendBadRequest(res, error as Error);
}

/**
 * Create a new thread reference
 */
service.createReferenceThread = async function (req, res) {
  if (!req.user || (req.user && !req.user.public)) {
    return errorService.sendForbidden(res);
  }

  // Validate userTo ID
  if (!isValidObjectId(req.body.userTo)) {
    return errorService.sendInvalidId(res);
  }
  try {
    const userTo = new mongoose.Types.ObjectId(req.body.userTo);
    // Make sure referenced thread exists and that UserFrom is participating in it.
    const threadQuery = Thread.findOne(
      {
        $or: [
          { userFrom: req.user._id, userTo },
          { userTo: req.user._id, userFrom: userTo },
        ],
      },
      'userTo userFrom',
    );
    let thread;
    try {
      thread = await (typeof threadQuery.exec === 'function'
        ? threadQuery.exec()
        : threadQuery);
    } catch {
      return res.status(400).send({ message: 'Thread does not exist.' });
    }
    if (!thread) {
      return res.status(400).send({ message: 'Thread does not exist.' });
    }
    let referenceUserToId: Types.ObjectId;
    if (thread.userTo && thread.userTo.equals(req.user._id)) {
      referenceUserToId = thread.userFrom;
    } else if (thread.userFrom && thread.userFrom.equals(req.user._id)) {
      referenceUserToId = thread.userTo;
    } else {
      return errorService.sendForbidden(res);
    }

    // The referenced person must have sent messages to the authenticated user.
    let message;
    try {
      const messageQuery = Message.findOne({
        userFrom: referenceUserToId,
        userTo: req.user._id,
      });
      message = await (typeof messageQuery.exec === 'function'
        ? messageQuery.exec()
        : messageQuery);
    } catch (error: unknown) {
      log('error', 'Thread reference: Not allowed per message rules. #158472', {
        error,
      });
      return res.status(403).send({
        message: 'Referenced person has not sent messages to you.',
      });
    }
    if (!message) {
      log('error', 'Thread reference: Not allowed per message rules. #158472', {
        error: null,
      });
      return res.status(403).send({
        message: 'Referenced person has not sent messages to you.',
      });
    }

    const referenceUserTo = await User.findById(referenceUserToId)
      .select('_id gender')
      .exec();
    if (!referenceUserTo) throw new Error('Failed to load referenced user.');

    const referenceThread = new ReferenceThread({
      reference: req.body.reference,
      thread: thread._id,
      userFrom: req.user._id,
      userTo: referenceUserTo._id,
    });

    const savedReferenceThread = await referenceThread.save();
    res.json(savedReferenceThread);

    // Doesn't care about already existing references for this thread.
    statService.stat(
      {
        namespace: 'threadReference',
        counts: { count: 1 },
        tags: {
          reference: referenceThread.reference,
          reporterGender: req.user.gender || 'unknown',
          reporteeGender: referenceUserTo.gender || 'unknown',
        },
      },
      () => {},
    );
  } catch (error: unknown) {
    return sendBadRequest(res, error);
  }
};

/**
 * Show the current Offer
 */
service.readReferenceThread = function (req, res) {
  res.json(req.referenceThread || {});
};

// Reference Thread reading middleware
service.readReferenceThreadById = async function (req, res, next, userToId) {
  // Check if user is authenticated
  if (!req.user) {
    return errorService.sendForbidden(res);
  }

  // Not a valid ObjectId
  if (!isValidObjectId(userToId)) {
    return errorService.sendInvalidId(res);
  }
  try {
    const referenceThread = await ReferenceThread.findOne({
      userTo: userToId,
      userFrom: req.user._id,
    })
      .sort('-created')
      .exec();
    if (referenceThread) {
      req.referenceThread = referenceThread;
      return next();
    }

    const message = await Message.findOne({
      userFrom: userToId,
      userTo: req.user._id,
    }).exec();
    return res.status(404).send({
      message: errorService.getErrorMessageByKey('not-found'),
      allowCreatingReference: Boolean(message),
    });
  } catch (error: unknown) {
    return next(error);
  }
};
const createReferenceThread = service.createReferenceThread;
const readReferenceThread = service.readReferenceThread;
const readReferenceThreadById = service.readReferenceThreadById;
export { createReferenceThread, readReferenceThread, readReferenceThreadById };
export default service;
