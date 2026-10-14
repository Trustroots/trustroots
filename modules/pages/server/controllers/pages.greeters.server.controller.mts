/** Public roster of current Trustroots greeters. */
import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import errorService from './../../../core/server/services/error.server.service.mjs';
import type { UserServerRecord } from '../../../users/server/models/user.server.types.mts';

interface Greeter {
  _id: UserServerRecord['_id'];
  username: string;
  displayName?: string;
}

type GreeterResponse = { greeters: Greeter[] } | { message: string };
const User = mongoose.model<UserServerRecord>('User');

export const list = (
  _req: Pick<Request, never>,
  res: Response<GreeterResponse>,
): void => {
  User.find<Pick<UserServerRecord, '_id' | 'username' | 'displayName'>>({
    public: true,
    roles: { $all: ['welcome-team'], $nin: ['suspended', 'shadowban'] },
  })
    .select('username displayName')
    .sort('displayName username')
    .limit(500)
    .then(
      users => {
        res.send({
          greeters: users.map(({ _id, username, displayName }) => ({
            _id,
            username,
            displayName,
          })),
        });
      },
      err =>
        res.status(500).send({
          message: errorService.getErrorMessage(err),
        }),
    );
};

const defaultInterop = { list };
export default defaultInterop;
export { defaultInterop as 'module.exports' };
