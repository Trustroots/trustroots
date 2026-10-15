/**
 * Module dependencies.
 */
import _ from 'lodash';
import errorService from './../../../core/server/services/error.server.service.mjs';
import mongoose, { type Types } from 'mongoose';

interface ThreadRecord {
  _id: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  updated?: Date;
  read?: boolean;
}

interface ThreadResult {
  _id: Types.ObjectId;
  read?: boolean;
  updated?: Date;
  userToProfile: Array<{
    _id: Types.ObjectId;
    username: string;
    displayName?: string;
    email?: string;
  }>;
  userFromProfile: Array<{
    _id: Types.ObjectId;
    username: string;
    displayName?: string;
  }>;
}

interface ThreadRequest {
  userIdFromUsername?: unknown;
  body?: unknown;
}

interface HttpResponse {
  status(code: number): HttpResponse;
  send(body: unknown): unknown;
}

const Thread = mongoose.model<ThreadRecord>('Thread');

/*
 * This middleware sends response with an array of found users
 */
export const getThreads = async (
  req: ThreadRequest,
  res: HttpResponse,
): Promise<unknown> => {
  // See `usernameToUserId` middleware from admin.users.server.controller.js
  // req.userId can get placed in request when `req.body.username` is set.
  const userId = req.userIdFromUsername || _.get(req, ['body', 'userId']);

  // Check that provided ID is valid
  if (!userId || !mongoose.Types.ObjectId.isValid(userId))
    return errorService.sendInvalidId(res);

  Thread.aggregate<ThreadResult>([
    {
      // Latest message in thread is either from, or to user
      $match: {
        $or: [
          {
            userFrom: new mongoose.Types.ObjectId(userId),
          },

          {
            userTo: new mongoose.Types.ObjectId(userId),
          },
        ],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userTo',
        foreignField: '_id',
        as: 'userToProfile',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userFrom',
        foreignField: '_id',
        as: 'userFromProfile',
      },
    },
    {
      $project: {
        _id: 1,
        read: 1,
        updated: 1,
        'userToProfile._id': 1,
        'userToProfile.username': 1,
        'userToProfile.displayName': 1,
        'userToProfile.email': 1,
        'userFromProfile._id': 1,
        'userFromProfile.username': 1,
        'userFromProfile.displayName': 1,
      },
    },
    {
      $sort: {
        updated: -1,
      },
    },
  ])
    .exec()
    .then(
      (threads: ThreadResult[]) => res.send(threads),
      (err: Error) => errorService.sendBadRequest(res, err),
    );
};
const defaultInterop = {
  getThreads,
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
