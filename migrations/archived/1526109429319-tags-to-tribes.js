/**
 * Refactros 'Tag' schema into 'Tribe' schema
 * - Renames the db
 * - Removes `tribe` keys
 */

const mongooseService = require('./../../config/lib/mongoose.mjs');
const mongoose = require('mongoose');
// eslint-disable-next-line no-unused-vars
const tribeModels = require('./../../modules/tribes/server/models/tribe.server.model.mjs');
const Tribe = mongoose.model('Tribe');
// eslint-disable-next-line no-unused-vars
const userModels = require('./../../modules/users/server/models/user.server.model.mjs');
const User = mongoose.model('User');

exports.up = function (next) {
  migrateUp().then(function () {
    disconnect(next);
  });
};

async function migrateUp() {
  // Bootstrap db connection
  const db = await connect();

  // Rename collection
  await renameCollection(db, 'tags', 'tribes');

  // Remove tribe keys
  const res = await Tribe
    .update(
      { 'tribe': { '$exists': true } },
      { $unset: { tribe: 1 } },
      { multi: true, strict: false },
    );
  console.log('Removed `tribe` keys:');
  console.log(res);

  // Restructure member key in User
  const users = await User.find({ 'member.0': { $exists: true } });
  console.log(users.length + ' users to process...');

  try {
    await Promise.all(users.map(function (user) {
      console.log('Processing user ' + user._id);
      const newMember = [];

      for (let i = 0; i !== user.member.length; ++i) {
        const membership = user.member[i].toObject();

        membership.tribe = membership.tag;
        delete membership.tag;
        delete membership.relation;
        newMember.push(membership);
      }

      return new Promise(function (resolve, reject) {
        User.update(
          { _id: user._id },
          { $set: {
            member: newMember,
          } },
          function (err) {
            console.log('🚩 User processed: ' + user._id);
            if (err) return reject(err);
            resolve();
          },
        );
      });
    }));
    console.log('All users have been processed successfully');
  } catch (err) {
    console.log('🚩 A user failed to process');
  }
}

exports.down = function (next) {
  next(new Error('No going back.'));
};

function connect() {
  return new Promise(function (resolve) {
    mongooseService.connect(function (db) {
      console.log('Connected to MongoDB.');
      resolve(db);
    });
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

function renameCollection(db, from, to) {
  return db.connections[0]
    .collection(from)
    .rename(to)
    .then(function () {
      console.log('Collection renamed: ' + from + ' → ' + to);
    })
    .catch(function (err) {
      console.log('Collection could not be renamed: ' + from + ' → ' + to);
      console.log(err);
    });
}
