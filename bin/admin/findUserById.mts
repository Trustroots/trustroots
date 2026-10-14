#!/usr/bin/env node
import trshell from './trshell.mts';
import type { HydratedDocument } from 'mongoose';
import type { AdminUserRecord } from './model-records.d.mts';

const User = trshell.mongoose.model<AdminUserRecord>('User');
const query = process.argv[2];
console.log(
  'Trustroots admin shell: find user by id\n',
  'Looking for user',
  query,
);
User.find(
  {
    _id: query,
  },
  function (
    _error: Error | null,
    docs: Array<HydratedDocument<AdminUserRecord>>,
  ) {
    if (docs.length > 0) {
      const d = docs[0];
      if (d) console.log(d.username, d.email, d.roles);
    }
    trshell.weAreDone();
  },
);
