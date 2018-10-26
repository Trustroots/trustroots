#!/usr/bin/env node

console.log ('Trustroots admin shell: show threads marked as not in spirit');


/***
@todo

Queries to work with:
db.referencethreads.aggregate({ "$match": { 'reference': 'no'}}, "$group": { _id: "$userTo", count: {$sum:1}}}, {$sort: {count: -1}});
db.referencethreads.aggregate({ "$match": { 'reference': 'no'}}, "$group": { _id: "$userFrom", count: {$sum:1}}}, {$sort: {count: -1}});

*/

var trshell = require('./trshell'),
    _ = require('lodash'),
    User = trshell.mongoose.model('User'),
    Thread = trshell.mongoose.model('Thread'),
    Message = trshell.mongoose.model('Message'),
    ReferenceThread = trshell.mongoose.model('ReferenceThread');


const findUser = async function (userId) {
  try {
    return await User.findOne({_id: userId});
  }
  catch(err) {
    console.log(err);
  }
}


var showMessage = function(id) {
  Message.find(
    {'_id': id},
    function(err, docs) {
      _.map(docs, async function(m) {
        var stuff = [await findUser(m.userFrom),
                     await findUser(m.userTo),
                     trshell.htmlFormat(m.content)
                    ];
        var promise = await Promise.all(stuff);
        console.log('from ' + promise[0].username + '\n',
                    'to ' + promise[1].username + '\n',
                    promise[2] + '\n\n');
      })
    }
  )
}


var showThread = async function(id) {
  Thread.find(
    {'_id': id},
    async function(err, docs) {
      await _.map(docs, function(t) {
        showMessage(t.message);
      });
      trshell.weAreDone();
    }
  )
}


const showBadRefs = function() {
  ReferenceThread.find(
    {'reference': 'no'},
    function(err, docs) {
      _.map(docs, async function(rt) {
        showThread(rt.thread);
      });
    }
  );
}

showBadRefs();
