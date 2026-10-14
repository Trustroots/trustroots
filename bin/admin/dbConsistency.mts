#!/usr/bin/env node
import trshell from './trshell.mts';
import _ from 'lodash';
import type { HydratedDocument } from 'mongoose';
import type { AdminUserRecord } from './model-records.d.mts';

const User = trshell.mongoose.model<AdminUserRecord>('User');
console.log('Trustroots admin shell: check database consistency');
User.find(
  {},
  async function (
    _error: Error | null,
    docs: Array<HydratedDocument<AdminUserRecord>>,
  ) {
    console.log("MEMBERS WHO CAN'T JOIN ANY CIRCLES");
    await _.map(docs, function (d) {
      _.map(d.member, function (m) {
        if (!m.tribe) {
          console.log(d.username, m);
        }
      });
    });
    trshell.weAreDone();
  },
);
