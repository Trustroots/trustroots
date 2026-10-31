/** Module dependencies. */
import _ from 'lodash';
import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import errorService from './../../../core/server/services/error.server.service.mjs';
import type { UserServerRecord } from '../../../users/server/models/user.server.types.mts';

interface Volunteer {
  _id: UserServerRecord['_id'];
  firstName: string;
  username: string;
}
type VolunteersResponse =
  { volunteers: Volunteer[]; alumni: Volunteer[] } | { message: string };
const User = mongoose.model<UserServerRecord>('User');

function filterAndCleanVolunteers(
  users: Pick<UserServerRecord, '_id' | 'firstName' | 'username' | 'roles'>[],
  role: string,
): Volunteer[] {
  return users
    .filter(user => user.roles.includes(role))
    .map(user => ({
      _id: user._id,
      firstName: user.firstName,
      username: user.username,
    }));
}

/**
 * This middleware sends response with an array of users with volunteer role
 * @esmNamed
 */
export const list = (
  _req: Pick<Request, never>,
  res: Response<VolunteersResponse>,
): void => {
  User.find<Pick<UserServerRecord, '_id' | 'firstName' | 'username' | 'roles'>>(
    {
      roles: {
        $in: ['volunteer', 'volunteer-alumni'],
      },
    },
  )
    .select('username firstName roles')
    .sort('firstName username')
    .limit(500)
    .then(
      users => {
        // Put to two groups based on role
        const volunteers = filterAndCleanVolunteers(users, 'volunteer');
        const alumni = filterAndCleanVolunteers(users, 'volunteer-alumni');
        res.send({
          volunteers: _.shuffle(volunteers),
          alumni: _.shuffle(alumni),
        });
      },
      err =>
        res.status(400).send({
          message: errorService.getErrorMessage(err),
        }),
    );
};

const defaultInterop = {
  list,
};
export default defaultInterop;
/** @commonjs */
export { defaultInterop as 'module.exports' };
