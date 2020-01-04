/**
 * Refactros 'Tag' schema into 'Tribe' schema
 * - Renames the db
 * - Removes `tribe` keys
 */

const path = require('path');
const async = require('async');
const chalk = require('chalk');
const mongooseService = require(path.resolve('./config/lib/mongoose'));
const mongoose = require('mongoose');
// eslint-disable-next-line no-unused-vars
const tribeModels = require(path.resolve('./modules/tribes/server/models/tribe.server.model'));
const Tribe = mongoose.model('Tribe');
// eslint-disable-next-line no-unused-vars
const userModels = require(path.resolve('./modules/users/server/models/user.server.model'));
const User = mongoose.model('User');

exports.up = function (next) {
  async.waterfall([
    // Bootstrap db connection
    function (done) {
      connect(done);
    },

    // Rename collection
    function (db, done) {
      renameCollection(db, 'tags', 'tribes', done);
    },

    // Remove tribe keys
    function (done) {
      Tribe
        .update(
          { 'tribe': { '$exists': true } },
          { $unset: { tribe: 1 } },
          { multi: true, strict: false },
        )
        .then(function (res) {
          console.log('Removed `tribe` keys:');
          console.log(res);
          done();
        });
    },

    // Restructure member key in User
    function (done) {
      User
        .find({ 'member.0': { $exists: true } })
        .then(function (users) {
          console.log(users.length + ' users to process...');

          async.each(users, function (user, callback) {
            console.log('Processing user ' + user._id);
            const newMember = [];

            for (let i = 0; i !== user.member.length; ++i) {
              const membership = user.member[i].toObject();

              membership.tribe = membership.tag;
              delete membership.tag;
              delete membership.relation;
              newMember.push(membership);
            }

            User.update(
              { _id: user._id },
              { $set: {
                member: newMember,
              } },
              function (err) {
                console.log('🚩 User processed: ' + user._id);
                callback(err);
              },
            );

          }, function (err) {
            if (err) {
              console.log('🚩 A user failed to process');
            } else {
              console.log('All users have been processed successfully');
            }
            done();
          });

        });

    },

  ], function (err) {
    if (err) {
      console.error(err);
    }
    disconnect(next);
  });
};

exports.down = function (next) {
  next(new Error('No going back.'));
};

function connect(done) {
  mongooseService.connect(function (db) {
    console.log(chalk.green('Connected to MongoDB.'));
    done(null, db);
  });
}

function disconnect(done) {
  // Disconnect before exiting
  mongooseService.disconnect(function (mongooseErr) {
    if (mongooseErr) {
      console.error(mongooseErr);
    }
    if (done) {
      done();
    }
  });
}

function renameCollection(db, from, to, done) {
  db.connections[0]
    .collection(from)
    .rename(to)
    .then(function () {
      console.log('Collection renamed: ' + from + ' → ' + to);
      done();
    })
    .catch(function (err) {
      console.log(chalk.red('Collection could not be renamed: ' + from + ' → ' + to));
      console.log(err);
      done();
    });
}
