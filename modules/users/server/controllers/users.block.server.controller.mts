import errorService from './../../../core/server/services/error.server.service.mjs';
import mongoose, { type Types } from 'mongoose';
import log from './../../../../config/lib/logger.mjs';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';

interface BlockRequest {
  user: UserServerDocument;
  profile?: Pick<UserServerDocument, '_id' | 'username'>;
  params?: { username: string };
}

interface BlockResponse {
  send(body: unknown): unknown;
  status(code: number): BlockResponse;
}

interface BlockController {
  getBlockedUsers(req: BlockRequest, res: BlockResponse): Promise<unknown>;
  blockUser(req: BlockRequest, res: BlockResponse): Promise<unknown>;
  unblockUser(req: BlockRequest, res: BlockResponse): Promise<unknown>;
}

const service = {} as BlockController;

/**
 * Module dependencies.
 */

const User = mongoose.model<UserServerRecord, UserServerModel>('User');

function logCaughtError(error: unknown): void {
  Reflect.apply(log, undefined, ['error', error]);
}

/**
 * Get the list of blocked users by the logged in user
 */
service.getBlockedUsers = async function (req, res) {
  try {
    const user = await User.findById(req.user._id)
      // Avoid pulling in sensitive fields from Mongoose
      .select('-password -salt')
      .populate({
        path: 'blocked',
        select: 'username displayName',
        model: 'User',
      });
    res.send(user!.blocked);
  } catch (err) {
    logCaughtError(err);
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('default'),
    });
  }
};

/**
 * Add a new userId to the blocked list
 */
service.blockUser = async function (req, res) {
  /*
   * req.profile was instantiated by a prev middleware
   */
  if (!req.profile || req.profile._id.equals(req.user._id)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }
  const idToBeBlocked: Types.ObjectId = req.profile._id;
  log('info', `${req.user._id} blocking ${idToBeBlocked}`);
  try {
    // get logged user and update
    const loggedUser = await User.updateOne(
      {
        _id: req.user._id,
      },
      {
        $addToSet: {
          blocked: idToBeBlocked,
        },
      },
    );

    // No documents were updated
    if (!loggedUser.matchedCount) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }
    res.send(`${req.profile.username} added to block list.`);
  } catch (err) {
    logCaughtError(err);
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('default'),
    });
  }
};

/**
 * Remove a user from the blocked list
 */
service.unblockUser = async function (req, res) {
  /*
   * req.profile was instantiated by a prev middleware
   */
  if (!req.profile) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }
  const idToBeUnBlocked = req.profile._id;
  log(
    'info',
    `${req.user._id} unblocking ${req.params!.username}:${idToBeUnBlocked}`,
  );
  try {
    // get logged user and update
    const result = await User.updateOne(
      {
        _id: req.user._id,
      },
      {
        $pullAll: {
          blocked: [idToBeUnBlocked],
        },
      },
    );

    // No documents were updated
    if (!result.matchedCount || !result.modifiedCount) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }
    res.send({
      message: `${req.profile.username} removed from block list.`,
    });
  } catch (err) {
    logCaughtError(err);
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('default'),
    });
  }
};
const defaultExport = service;
export default defaultExport;
export const blockUser = defaultExport.blockUser;
export const getBlockedUsers = defaultExport.getBlockedUsers;
export const unblockUser = defaultExport.unblockUser;
export { defaultExport as 'module.exports' };
