/**
 * Refactors `users` array to `userTo` and `userFrom` keys from Contact collection
 */

const mongooseService = require('./../../config/lib/mongoose.mjs');
const mongoose = require('mongoose');
// userModels = require(path.resolve('./modules/users/server/models/user.server.model')),
// User = mongoose.model('User'),
// eslint-disable-next-line no-unused-vars
const contactModels = require('./../../modules/contacts/server/models/contacts.server.model.mjs');
const Contact = mongoose.model('Contact');

exports.up = function (next) {

  migrateUp()
    .catch(function (err) {
      console.error(err);
    })
    .then(function () {
      disconnect(next);
    });

};

exports.down = function (next) {

  migrateDown()
    .catch(function (err) {
      console.error(err);
    })
    .then(function () {
      disconnect(next);
    });

};

async function migrateUp() {

  // Bootstrap db connection
  await connect();

  // Get all contact documents
  const contacts = await findContacts(
    Contact.find({ users: { $exists: true } }),
  );

  // No contacts to process
  if (!contacts.length) {
    console.log('No contacts to process');
    return;
  }

  // Count how many contacts we've processed
  let counter = 0;

  try {
    for (const contact of contacts) {
      // Process contact
      const contactObject = contact.toObject();
      await new Promise(function (resolve, reject) {
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
            if (err) return reject(err);
            // Succesfully saved this contact
            if (raw.nModified === 1) {
              counter++;
            }
            resolve();
          },
        );
      });
    }
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    // All done
    console.log('Processed ' + counter + ' of ' + contacts.length + ' contacts.');
  }

}

async function migrateDown() {

  // Bootstrap db connection
  await connect();

  // Get all contact documents
  const contacts = await findContacts(
    Contact.find({ users: { $exists: false } }).limit(5),
  );

  // No contacts to process
  if (!contacts.length) {
    console.log('No contacts to process');
  }

}

function connect() {
  return new Promise(function (resolve) {
    mongooseService.connect(function () {
      console.log('Connected to MongoDB.');
      resolve();
    });
  });
}

function findContacts(query) {
  return new Promise(function (resolve, reject) {
    query.exec(function (err, contacts) {
      if (contacts) {
        console.log('Found ' + contacts.length + ' contacts to convert.');
      }
      if (err) return reject(err);
      resolve(contacts);
    });
  });
}

function disconnect(next) {
  // Disconnect before exiting
  mongooseService.disconnect(function (mongooseErr) {
    if (mongooseErr) {
      console.error(mongooseErr);
    }
    next();
  });
}
