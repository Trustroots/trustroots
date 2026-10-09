#!/usr/bin/env node
import trshell from './trshell.mjs';
import _ from 'lodash';
var User = trshell.mongoose.model('User');
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
  async function (err, docs) {
    await _.map(docs, function (d) {
      console.log(d.username, d.email, d.displayName, d.roles, d._id);
    });
    trshell.weAreDone();
  },
);
