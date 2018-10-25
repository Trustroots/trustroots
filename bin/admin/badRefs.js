#!/usr/bin/env node

console.log ('Trustroots admin shell: show threads marked as not in spirit');

var // async = require('async'),
    mongoose = require('mongoose'),
    mongooseService = require('../config/lib/mongoose'),
    _ = require('lodash');

mongooseService.connect();
mongooseService.loadModels();

var Message = mongoose.model('Message'),
    Thread = mongoose.model('Thread'),
    User = mongoose.model('User'),
    ReferenceThread = mongoose.model('ReferenceThread');

var htmlFormat = function(s) {
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


// At some point it should disconnect.
// mongooseService.disconnect();
