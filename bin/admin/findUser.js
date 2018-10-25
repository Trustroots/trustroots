#!/usr/bin/env node

console.log ('Trustroots admin shell: find user');


// Ensuring that we're in the right directory
process.chdir(__dirname);
process.chdir('../../');

var _ = require('lodash'),
    async = require('async'),
    mongoose = require('mongoose'),
    path = require('path'),
    mongooseService = require(path.resolve('config/lib/mongoose'));

// TODO: turn off mongoose logging feedback

mongooseService.connect();
mongooseService.loadModels();
mongoose.set('debug', false);

var Message = mongoose.model('Message'),
    Thread = mongoose.model('Thread'),
    User = mongoose.model('User'),
    ReferenceThread = mongoose.model('ReferenceThread');

const query = process.argv[2];

console.log ('Looking for', query);

var areWeDone = false;


const re = new RegExp('.*' + query + '.*', 'i')
User.find({ $or: [
  { 'username': { $regex: re }},
  { 'email': { $regex: re }},
  { 'displayName': { $regex: re }},
]}, function(err, docs) {
  _.map(docs, function(d) {
    console.log(d.username, d.email);
  });
  areWeDone = true;
});



// This doesn't seem right, but it does the job.
var timeout = setInterval(function() {
  if (areWeDone) {
    mongooseService.disconnect();
    clearInterval(timeout);
  }
}, 3000);
