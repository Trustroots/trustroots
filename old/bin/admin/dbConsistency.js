#!/usr/bin/env node

var trshell = require('./trshell'),
    _ = require('lodash'),
    User = trshell.mongoose.model('User');

console.log ('Trustroots admin shell: check database consistency');

User.find( {}, async function(err, docs) {
  console.log("MEMBERS WHO CAN'T JOIN ANY CIRCLES");
  await _.map(docs, function(d) {
    _.map(d.member, function(m) {
      if (!m.tribe) {
        console.log(d.username, m);
      }
    });
  });
  trshell.weAreDone();
});
