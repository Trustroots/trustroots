#!/usr/bin/env node

console.log ('Trustroots admin shell: show threads marked as not in spirit');


/***
@todo

Queries to work with:
db.referencethreads.aggregate({ "$match": { 'reference': 'no'}}, "$group": { _id: "$userTo", count: {$sum:1}}}, {$sort: {count: -1}});
db.referencethreads.aggregate({ "$match": { 'reference': 'no'}}, "$group": { _id: "$userFrom", count: {$sum:1}}}, {$sort: {count: -1}});

*/

var trshell = require('./trshell'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    Thread = mongoose.model('Thread'),
    ReferenceThread = mongoose.model('ReferenceThread');

const htmlFormat = function(s) {
  // Quick'n'dirty way of ditching HTML
  return (s.replace(/\<.*?\>/gi, ''));
}

const findUser = async function (userId) {
  try {
    return await User.findOne({_id: userId});
  }
  catch(err) {
    console.log(err);
  }
}

var areWeDone = false;


var showMessage = function(id) {
  Message.find(
    {'_id': id},
    function(err, docs) {
      _.map(docs, async function(m) {
        var stuff = [await findUser(m.userFrom),
                     await findUser(m.userTo),
                     htmlFormat(m.content)
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
    function(err, docs) {
      _.map(docs, function(t) {
        showMessage(t.message);
      });
      areWeDone = true;
    }
  )
}




const showBadRefs = function() {
  ReferenceThread.find(
    {'reference': 'no'},
    async function(err, docs) {
      await _.map(docs, async function(rt) {
        await showThread(rt.thread);
      });
    }
  );
}

showBadRefs();


// This doesn't seem right, but it does the job.
var timeout = setInterval(function() {
  if (areWeDone) {
    trshell.disconnect();
    clearInterval(timeout);
  }
}, 3000);
