#!/usr/bin/env node

/**
 * A script to create csv files for importing newsletter subscribers to Mailtrain
 *
 * Usage:
 * NODE_ENV=production node bin/export-newsletter-subscribers.js /srv/newsletters/subscribers_2015-08-31.csv
 */

const chalk = require('chalk');
const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');

const mongooseService = require(path.resolve('./config/lib/mongoose'));
require(path.resolve('./config/lib/express'));
require(path.resolve('./modules/users/server/models/user.server.model'));

let csvFile = null;

// This is where CSV lines are generated
// First line is the header
let data = 'Email Address,First Name,Last Name';

console.log(chalk.white('--'));
console.log(chalk.green('Trustroots newsletter subscribers CSV export'));
console.log(chalk.white('--'));

// Export file is required
if (process.argv[2] === null) {
  console.log(chalk.red('Please give export file path!'));
  console.log('Example:');
  console.log('node export-newsletter-subscribers.js ~/emails.csv');
  process.exit(0);
  return;
}

// Export file path
csvFile = process.argv[2];

// Bootstrap db connection
mongooseService.connect(() => {
  mongooseService.loadModels(() => {
    const User = mongoose.model('User');

    console.log('Gathering subscribers...');
    User.find(
      { public: true, newsletter: true },
      { email: 1, firstName: 1, lastName: 1 },
    ).exec((err, users) => {
      mongooseService.disconnect(() => {
        console.log(`Found ${users.length} subscribers.`);
        if (err) {
          console.error(chalk.red('Error:'));
          console.error(err);
          process.exit(1);
          return;
        }

        if (users.length <= 0) {
          console.error(chalk.red('Could not find any users!'));
          process.exit(1);
          return;
        }

        // Loop users
        users.forEach(user => {
          data += '\n';
          data += [user.email, user.firstName, user.lastName]
            .map(string => string.trim().replace(',', ''))
            .join(',');
        });

        // Write contents
        console.log(`Writing content to ${csvFile}`);
        fs.writeFile(csvFile, data, err => {
          if (err) {
            console.error(chalk.red('Error while saving the file!'));
            console.error(err);
            process.exit(1);
            return;
          }

          console.log('Done!');
          console.log(chalk.white('')); // Reset to white
          process.exit(0);
        });
      });
    });
  });
});
