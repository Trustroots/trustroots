#!/usr/bin/env node
import trshell from './trshell.mts';
import _ from 'lodash';
import type { HydratedDocument } from 'mongoose';
import type { AdminUserRecord } from './model-records.d.mts';

const User = trshell.mongoose.model<AdminUserRecord>('User');
const query = process.argv[2];
console.log('Trustroots admin shell: find user');
console.log('Looking for user', query);
const re = new RegExp('.*' + query + '.*', 'i');
const requery = {
  $regex: re,
};
User.find(
  {
    $or: [
      {
        email: requery,
      },
      {
        username: requery,
      },
      {
        displayName: requery,
      },
    ],
  },
  async function (
    _error: Error | null,
    docs: Array<HydratedDocument<AdminUserRecord>>,
  ) {
    await _.map(docs, function (d) {
      console.log(d.username, d.email, d.displayName, d.roles, d._id);
    });
    trshell.weAreDone();
  },
);
