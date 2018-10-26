#!/usr/bin/env node

var trshell = require('./trshell'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    User = mongoose.model('User');

const query = process.argv[2];

console.log ('Trustroots admin shell: find user');
console.log ('Looking for user', query);

const re = new RegExp('.*' + query + '.*', 'i')
User.find( { $or: [
  { 'username': { $regex: re }},
  { 'email': { $regex: re }},
  { 'displayName': { $regex: re }},
  //  { '_id': query },    // somehow this doesn't properly $or
]}
, function(err, docs) {
  _.map(docs, function(d) {
    console.log(d.username, d.email, d.roles);
  });
  trshell.weAreDone();
});
