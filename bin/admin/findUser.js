#!/usr/bin/env node

console.log ('Trustroots admin shell: find user');

var trshell = require('./trshell'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    User = mongoose.model('User');



const query = process.argv[2];

console.log ('Looking for user', query);

var areWeDone = false;

const re = new RegExp('.*' + query + '.*', 'i')
User.find( { $or: [
  { 'username': { $regex: re }},
  { 'email': { $regex: re }},
  { 'displayName': { $regex: re }},
  //  { '_id': query },    // somehow this doesn't properly $or
]}
, function(err, docs) {
  _.map(docs, function(d) {
    console.log(d.username, d.email);
  });
  areWeDone = true;
});



// This doesn't seem right, but it does the job.
var timeout = setInterval(function() {
  if (areWeDone) {
    trshell.disconnect();
    clearInterval(timeout);
  }
}, 3000);
