#!/usr/bin/env node

/**
 * A script to create csv files for importing circle members to a newsletter tool
 *
 * Usage:
 * NODE_ENV=production node bin/export-circle-members.js circle-ID ~/circle_emails_2021-01-01.csv
 */

const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');

const mongooseService = require(path.resolve('./config/lib/mongoose'));
require(path.resolve('./config/lib/express'));
require(path.resolve('./modules/users/server/models/user.server.model'));
require(path.resolve('./modules/tribes/server/models/tribe.server.model'));

// This is where CSV lines are generated
// First line is the header
let data = 'Email Address,First Name,Last Name';

console.log('Trustroots Circle members CSV export');

function showExampleAndExit() {
  console.log('Example:');
  console.log('node export-circle-members.js circle-ID ~/emails.csv');
  process.exit(0);
}

// Circle name
const circleId = process.argv[2];

if (!mongoose.Types.ObjectId.isValid(circleId)) {
  console.log('Please give valid circle Mongo ID!');
  showExampleAndExit();
  return;
}

if (!circleId) {
  console.log('Please give circle Mongo ID!');
  showExampleAndExit();
  return;
}

// Export file path
const csvFile = process.argv[3];

if (!csvFile) {
  console.log('Please give export file path!');
  showExampleAndExit();
  return;
}

// Bootstrap db connection
mongooseService.connect(() => {
  mongooseService.loadModels(async () => {
    const User = mongoose.model('User');
    const Tribe = mongoose.model('Tribe');

    const circleObjectId = new mongoose.Types.ObjectId(circleId);
    const circle = await Tribe.findById(circleObjectId);

    console.log(`\nGathering members from circle ${circle.label}...`);
    User.find(
      {
        'member.tribe': circleObjectId,
        public: true,
      },
      { email: 1, firstName: 1, lastName: 1 },
    ).exec((err, users) => {
      mongooseService.disconnect(() => {
        console.log(`Found ${users.length} members.`);
        if (err) {
          console.error('Error:', err);
          process.exit(1);
          return;
        }

        if (users.length <= 0) {
          console.error('Could not find any users!');
          process.exit(1);
          return;
        }

        // Loop users
        users.forEach(user => {
          data += '\n';
          data += [user.email, user.firstName, user.lastName]
            .map(value =>
              // Sanitize data for CSV compatibility
              value.trim().replace("'", '').replace('"', '').replace(',', ''),
            )
            .join(',');
        });

        // Write contents
        console.log(`\nWriting content to ${csvFile}`);
        fs.writeFile(csvFile, data, err => {
          if (err) {
            console.error('Error while saving the file!', err);
            process.exit(1);
            return;
          }

          console.log('Done!');
          process.exit(0);
        });
      });
    });
  });
});
