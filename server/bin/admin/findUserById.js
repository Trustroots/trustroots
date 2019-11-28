#!/usr/bin/env node

var trshell = require('./trshell'),
    User = trshell.mongoose.model('User');

const query = process.argv[2];

console.log ('Trustroots admin shell: find user by id\n',
             'Looking for user', query);

User.find({ '_id': query }, function(err, docs) {
  if (docs) {
    const d = docs[0];
    console.log(d.username, d.email, d.roles);
  }
  trshell.weAreDone();
});
