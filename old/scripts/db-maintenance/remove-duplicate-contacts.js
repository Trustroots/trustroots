/**
 * A script to remove duplicate contacts
 * Initial issue was fixed at https://github.com/Trustroots/trustroots/pull/372
 *
 * Usage:
 * NODE_ENV=development node scripts/db-maintenance/remove-duplicate-contacts.js
 */

var path = require('path'),
    async = require('async'),
    config = require(path.resolve('./config/config')),
    configMongoose = require(path.resolve('./config/lib/mongoose')),
    configExpress = require(path.resolve('./config/lib/express')),
    chalk = require('chalk'),
    mongoose = require('mongoose'),
    contactsModels = require(path.resolve('./modules/contacts/server/models/contacts.server.model')),
    Contact = mongoose.model('Contact');

console.log(chalk.white('--'));
console.log(chalk.green('Trustroots - remove duplicate contacts from the DB'));
console.log(chalk.white('--'));

console.log('Connecting to MongoDB');
console.log(config.db.uri);

var removedCounter = 0,
    totalRecordsWithIssues,
    totalInitialContacts;

// Bootstrap db connection
mongoose.connect(config.db.uri, function(err) {
  if (err) {
    console.error(chalk.red('Could not connect to MongoDB!'));
    console.log(err);
    process.exit(0);
  }
});

console.log('Gathering data...');

// Create a queue worker for removing records
// @link https://github.com/caolan/async#queueworker-concurrency
var q = async.queue(function (contactId, callback) {
  console.log('Removing ' + contactId);
  Contact.findByIdAndRemove(contactId, function(err) {
    if(err) {
      console.error('Failed to remove contact record ' + contactId);
      callback();
    }
    else {
      removedCounter++;
      callback();
    }
  })
}, 2); // How many jobs to process simultaneously?

// Assign a final callback to removal queue
q.drain = function() {
  console.log('');
  console.log('Removing duplicate records done.');

  // All done
  Contact.find().count().exec(function(err, contactsCount) {
    console.log('- Found ' + totalRecordsWithIssues + ' problematic contact records.');
    console.log('- Removed ' + removedCounter + ' contact records.');
    console.log('- ' + contactsCount + ' contact records of ' + totalInitialContacts + ' left after this script.')
    process.exit(0);
  });
};

// Check for initial count
Contact.find().count().exec(function(err, contactsCount) {
  if (err) {
    console.error(chalk.red('Error:'));
    console.log(err);
    process.exit(1);
  } else if (contactsCount === 0) {
    console.log(chalk.green('Could not find any contact records to test.'));
    process.exit(0);
  } else {
    // Save total
    totalInitialContacts = contactsCount;

    // Aggregate duplicate contacts
    Contact.aggregate([
      // Pick only relevant fields
      {$project: { _id: 1, users: 1 } },

      // Unwind users array, sort IDs and group IDs back to array
      {$unwind: '$users'},
      {$sort: {'users': 1}},
      {$group: {_id: '$_id', 'users': {$push: '$users'}}},
      {$project: {'users': '$users'}},

      // Group similar arrays together and count them, include original doc ids
      {$group: { _id: "$users", count: { $sum: 1 }, 'ids': {$push: '$_id'} }},

      // Choose only with multiple matches
      { $match: { count: { $gt: 1 } }}
    ], function(err, issueContacts) {
        if (err) {
          console.error(chalk.red('Error:'));
          console.log(err);
          process.exit(1);
        } else if (issueContacts.length <= 0) {
          console.log(chalk.green('Could not find any records with issues.'));
          process.exit(0);
        } else {
          totalRecordsWithIssues = issueContacts.length;
          console.log('Found ' + totalRecordsWithIssues + ' contact records with issues...');

          // Skip first contact record and push others for removing
          for (var i = 0; i < issueContacts.length; i++) {
            // Note that this skips the first id as we don't want
            // to remove all the contacts, just those extra duplicate ones. E.g.:
            // [A, B] - leave
            // [A, B] - remove
            // [B, A] - remove
            // [A, C] - leave
            for (var j = 1; j < issueContacts[i].ids.length; j++) {
              q.push(issueContacts[i].ids[j]);
            }
          }
        }
    });
  }
});
