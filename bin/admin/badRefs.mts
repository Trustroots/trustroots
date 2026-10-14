#!/usr/bin/env node
import trshell from './trshell.mts';
import _ from 'lodash';
import type { HydratedDocument } from 'mongoose';
import type {
  AdminId,
  AdminMessageRecord,
  AdminReferenceThreadRecord,
  AdminThreadRecord,
  AdminUserRecord,
} from './model-records.d.mts';
console.log('Trustroots admin shell: show threads marked as not in spirit');

/**
@todo

Queries to work with:
db.referencethreads.aggregate({ "$match": { 'reference': 'no'}}, "$group": { _id: "$userTo", count: {$sum:1}}}, {$sort: {count: -1}});
db.referencethreads.aggregate({ "$match": { 'reference': 'no'}}, "$group": { _id: "$userFrom", count: {$sum:1}}}, {$sort: {count: -1}});

*/

const User = trshell.mongoose.model<AdminUserRecord>('User');
const Thread = trshell.mongoose.model<AdminThreadRecord>('Thread');
const Message = trshell.mongoose.model<AdminMessageRecord>('Message');
const ReferenceThread =
  trshell.mongoose.model<AdminReferenceThreadRecord>('ReferenceThread');
const findUser = async function (userId: AdminId) {
  try {
    return await User.findOne({
      _id: userId,
    });
  } catch (err) {
    console.log(err);
  }
};
const showMessage = function (id: AdminId) {
  Message.find(
    {
      _id: id,
    },
    function (
      _error: Error | null,
      docs: Array<HydratedDocument<AdminMessageRecord>>,
    ) {
      _.map(docs, async function (m) {
        const stuff = [await findUser(m.userFrom), await findUser(m.userTo)];
        const [from, to] = await Promise.all(stuff);
        if (from == null || to == null) return;
        console.log(
          'from ' + from.username + '\n',
          'to ' + to.username + '\n',
          trshell.htmlFormat(m.content) + '\n\n',
        );
      });
    },
  );
};
const showThread = async function (id: AdminId) {
  Thread.find(
    {
      _id: id,
    },
    async function (
      _error: Error | null,
      docs: Array<HydratedDocument<AdminThreadRecord>>,
    ) {
      await _.map(docs, function (t) {
        showMessage(t.message);
      });
      trshell.weAreDone();
    },
  );
};
const showBadRefs = function () {
  ReferenceThread.find(
    {
      reference: 'no',
    },
    function (
      _error: Error | null,
      docs: Array<HydratedDocument<AdminReferenceThreadRecord>>,
    ) {
      _.map(docs, async function (rt) {
        showThread(rt.thread);
      });
    },
  );
};
showBadRefs();
