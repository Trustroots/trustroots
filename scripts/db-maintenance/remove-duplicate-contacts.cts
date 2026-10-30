import type { LegacyMongoose } from '../legacy-cli-contracts.d.cts';
import type { Types } from 'mongoose';
interface DuplicateContacts {
  ids: Types.ObjectId[];
  count: number;
}
/**
 * A script to remove duplicate contacts
 * Initial issue was fixed at https://github.com/Trustroots/trustroots/pull/372
 *
 * Usage:
 * NODE_ENV=development node scripts/db-maintenance/remove-duplicate-contacts.cts
 */

const config = require('./../../config/config.mts');
require('./../../config/lib/mongoose.mjs');
require('./../../config/lib/express.mjs');
const mongoose = require('mongoose') as LegacyMongoose;
const { forEachWithConcurrency } =
  require('./../../modules/core/server/services/task-queue.server.service.mts') as typeof import('../../modules/core/server/services/task-queue.server.service.mts').default;
require('./../../modules/contacts/server/models/contacts.server.model.mjs');
const Contact = mongoose.model<{ users: Types.ObjectId[] }>('Contact');

console.log('--');
console.log('Trustroots - remove duplicate contacts from the DB');
console.log('--');

console.log('Connecting to MongoDB');
console.log(config.db.uri);

let removedCounter = 0;
let totalRecordsWithIssues: number | undefined;
let totalInitialContacts: number | undefined;

// Bootstrap db connection
mongoose.set('strictQuery', false);
mongoose.connect(config.db.uri).catch(function (err) {
  console.error('Could not connect to MongoDB!');
  console.log(err);
  process.exit(0);
});

console.log('Gathering data...');

function removeContacts(contactIds: Types.ObjectId[]) {
  // Remove at most 2 records simultaneously
  return forEachWithConcurrency(contactIds, 2, async function (contactId) {
    console.log('Removing ' + contactId);
    try {
      await Contact.findByIdAndDelete(contactId);
      removedCounter++;
    } catch {
      console.error('Failed to remove contact record ' + contactId);
    }
  });
}

function reportRemoval() {
  console.log('');
  console.log('Removing duplicate records done.');

  // All done
  return Contact.countDocuments().then(function (contactsCount) {
    console.log(
      '- Found ' + totalRecordsWithIssues + ' problematic contact records.',
    );
    console.log('- Removed ' + removedCounter + ' contact records.');
    console.log(
      '- ' +
        contactsCount +
        ' contact records of ' +
        totalInitialContacts +
        ' left after this script.',
    );
    process.exit(0);
  });
}

// Check for initial count
Contact.countDocuments()
  .then(function (contactsCount) {
    if (contactsCount === 0) {
      console.log('Could not find any contact records to test.');
      process.exit(0);
    } else {
      // Save total
      totalInitialContacts = contactsCount;

      // Aggregate duplicate contacts
      return Contact.aggregate<DuplicateContacts>([
        // Pick only relevant fields
        { $project: { _id: 1, users: 1 } },

        // Unwind users array, sort IDs and group IDs back to array
        { $unwind: '$users' },
        { $sort: { users: 1 } },
        { $group: { _id: '$_id', users: { $push: '$users' } } },
        { $project: { users: '$users' } },

        // Group similar arrays together and count them, include original doc ids
        {
          $group: {
            _id: '$users',
            count: { $sum: 1 },
            ids: { $push: '$_id' },
          },
        },

        // Choose only with multiple matches
        { $match: { count: { $gt: 1 } } },
      ]).then(function (issueContacts) {
        if (issueContacts.length <= 0) {
          console.log('Could not find any records with issues.');
          process.exit(0);
        } else {
          totalRecordsWithIssues = issueContacts.length;
          console.log(
            'Found ' +
              totalRecordsWithIssues +
              ' contact records with issues...',
          );

          // Skip first contact record and push others for removing
          const duplicateIds: Types.ObjectId[] = [];
          for (let i = 0; i < issueContacts.length; i++) {
            // Note that this skips the first id as we don't want
            // to remove all the contacts, just those extra duplicate ones. E.g.:
            // [A, B] - leave
            // [A, B] - remove
            // [B, A] - remove
            // [A, C] - leave
            for (let j = 1; j < issueContacts[i].ids.length; j++) {
              duplicateIds.push(issueContacts[i].ids[j]);
            }
          }
          return removeContacts(duplicateIds).then(reportRemoval);
        }
      });
    }
  })
  .catch(function (err) {
    console.error('Error:');
    console.log(err);
    process.exit(1);
  });
