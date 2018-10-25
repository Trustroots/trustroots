#!/usr/bin/env node

console.log ('Trustroots admin shell: show threads marked as not in spirit');


// Ensuring that we're in the right directory
process.chdir(__dirname);
process.chdir('../../');

var _ = require('lodash'),
    async = require('async'),
    mongoose = require('mongoose'),
    path = require('path'),
    mongooseService = require(path.resolve('config/lib/mongoose'));

mongooseService.connect();
mongooseService.loadModels();

var Message = mongoose.model('Message'),
    Thread = mongoose.model('Thread'),
    User = mongoose.model('User'),
    ReferenceThread = mongoose.model('ReferenceThread');

var htmlFormat = function(s) {
  // Quick'n'dirty way of ditching HTML
  return (s.replace(/\<.*?\>/gi, ''));
}


var showMessage = function(id) {
  Message.find(
    {'_id': id},
    function(err, docs) {
      _.map(docs, function(m) {
        console.log(m.userFrom);
        console.log(m.userTo);
        console.log(htmlFormat(m.content));
      })
    }
  )
}


var showThread = function(id) {
  Thread.find(
    {'_id': id},
    function(err, docs) {
      _.map(docs, function(t) {
        showMessage(t.message);
      })
    }
  )
}

ReferenceThread.find(
  {'reference': 'no'},
  function(err, docs) {
    _.map(docs, function(rt) {
      showThread(rt.thread);
    });
  }
);


// At some point it should disconnect. Not yet sure how to do this.
// mongooseService.disconnect();
