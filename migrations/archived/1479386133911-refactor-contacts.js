/**
 * Refactors `users` array to `userTo` and `userFrom` keys from Contact collection
 */

const path = require('path');
const async = require('async');
const mongooseService = require(path.resolve('./config/lib/mongoose'));
const mongoose = require('mongoose');
const chalk = require('chalk');
// userModels = require(path.resolve('./modules/users/server/models/user.server.model')),
// User = mongoose.model('User'),
// eslint-disable-next-line no-unused-vars
const contactModels = require(path.resolve('./modules/contacts/server/models/contacts.server.model'));
const Contact = mongoose.model('Contact');

exports.up = function (next) {

  async.waterfall([

    // Bootstrap db connection
    function (done) {
      mongooseService.connect(function () {
        console.log(chalk.green('Connected to MongoDB.'));
        done();
      });
    },

    // Get all contact documents
    function (done) {
      Contact
        .find({ users: { $exists: true } })
        .exec(function (err, contacts) {
          if (contacts) {
            console.log('Found ' + contacts.length + ' contacts to convert.');
          }
          done(err, contacts);
        });
    },

    // Update each contact document
    function (contacts, done) {

      // No contacts to process
      if (!contacts.length) {
        console.log('No contacts to process');
        return done();
      }

      // Count how many contacts we've processed
      let counter = 0;

      // `mapSeries` runs only a single async operation at a time.
      async.mapSeries(
        contacts,
        // Iterate each contact using this function
        // Must call `contactDone()` after done
        function (contact, contactDone) {
          // Process contact
          const contactObject = contact.toObject();
          Contact.update(
            { _id: contact._id },
            {
              $set: {
                // users[0] contains contact requester's id, users[1] is the receiver
                userFrom: contactObject.users[0],
                userTo: contactObject.users[1],
              },
              $unset: {
                users: '',
              },
            },
            {
              // Mongoose will only update fields defined in the schema.
              // However, you can override that default behavior by
              // including the `strict:false` option
              strict: false,
              // Limits updates only to one document per update
              multi: false,
            },
            function (err, raw) {
              // Succesfully saved this contact
              if (!err && raw.nModified === 1) {
                counter++;
              }
              // Moves on to next one in array
              contactDone(err);
            },
          );
        },
        // Final callback after all the contacts are processed
        function (err) {
          if (err) {
            console.error(err);
          }
          // All done
          console.log('Processed ' + counter + ' of ' + contacts.length + ' contacts.');
          done(err);
        },
      );
    },

  ], function (err) {
    if (err) {
      console.error(err);
    }
    // Disconnect before exiting
    mongooseService.disconnect(function (mongooseErr) {
      if (mongooseErr) {
        console.error(mongooseErr);
      }
      next();
    });
  });

};

exports.down = function (next) {

  async.waterfall([

    // Bootstrap db connection
    function (done) {
      mongooseService.connect(function () {
        console.log(chalk.green('Connected to MongoDB.'));
        done();
      });
    },

    // Get all contact documents
    function (done) {
      Contact
        .find({ users: { $exists: false } })
        .limit(5)
        .exec(function (err, contacts) {
          if (contacts) {
            console.log('Found ' + contacts.length + ' contacts to convert.');
          }
          done(err, contacts);
        });
    },

    // Update each contact document
    function (contacts, done) {

      // No contacts to process
      if (!contacts.length) {
        console.log('No contacts to process');
        return done();
      }

      done();

    },

  ], function (err) {
    if (err) {
      console.error(err);
    }
    // Disconnect before exiting
    mongooseService.disconnect(function (mongooseErr) {
      if (mongooseErr) {
        console.error(mongooseErr);
      }
      next();
    });
  });

};
