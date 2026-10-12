#!/usr/bin/env node
import trshell from './trshell.mjs';
import _ from 'lodash';
var User = trshell.mongoose.model('User');
console.log('Trustroots admin shell: check database consistency');
const docs = await User.find({});
console.log("MEMBERS WHO CAN'T JOIN ANY CIRCLES");
_.map(docs, function (d) {
  _.map(d.member, function (m) {
    if (!m.tribe) {
      console.log(d.username, m);
    }
  });
});
trshell.weAreDone();
