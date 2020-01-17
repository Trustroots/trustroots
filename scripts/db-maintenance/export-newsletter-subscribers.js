/**
 * A script to create csv files for importing newsletter subscribers to MailChimp
 * http://kb.mailchimp.com/lists/growth/import-subscribers-to-a-list#Import-From-a-CSV,-TXT,-or-Excel-File
 *
 * Usage:
 * NODE_ENV=production node scripts/export-newsletter-subscribers.js /srv/newsletters/subscribers_2015-08-31.csv
 */

var _ = require('lodash'),
    path = require('path'),
    config = require(path.resolve('./config/config')),
    configMongoose = require(path.resolve('./config/lib/mongoose')),
    configExpress = require(path.resolve('./config/lib/express')),
    chalk = require('chalk'),
    fs = require('fs'),
    mongoose = require('mongoose'),
    userModels = require(path.resolve('./modules/users/server/models/user.server.model')),
    User = mongoose.model('User'),
    csvFile = null;

// This is where CSV lines are generated
// First line is the header
var data = 'Email Address,First Name,Last Name';

console.log(chalk.white('--'));
console.log(chalk.green('Trustroots newsletter subscribers CSV export'));
console.log(chalk.white('--'));


// Export file is required
if (process.argv[2] == null) {
  console.log(chalk.red('Please give export file path!'));
  console.log('Example:');
  console.log('node export-newsletter-subscribers.js ~/emails.csv');
}
else {

  // Export file path
  csvFile = process.argv[2];

  console.log('Connecting to MongoDB');
  console.log(config.db.uri);

  // Bootstrap db connection
  var db = mongoose.connect(config.db.uri, function(err) {
    if (err) {
      console.error(chalk.red('Could not connect to MongoDB!'));
      console.log(err);
      process.exit(0);
    }
  });

  console.log('Gathering users...');

  // Loop trough
  User.find({newsletter:true}, {email: 1, firstName: 1, lastName: 1})
  .exec(function(err, users) {
    console.log('Found ' + users.length + ' users.');
    if (err) {
      console.error(chalk.red('Error:'));
      console.log(err);
      process.exit(0);
    } else if (users.length <= 0) {
      console.error(chalk.red('Could not find any users!'));
      console.log(err);
      process.exit(0);
    } else {

      // Loop users
      users.forEach(function(user) {
        data += '\n';
        data += user.email.trim().replace(',', '') + ',' + user.firstName.trim().replace(',', '') + ',' + user.lastName.trim().replace(',', '');
      });

      // Write contents
      console.log('Writing content to ' + csvFile);
      fs.writeFile(csvFile, data, function(err) {
          if (err) {
            console.error(chalk.red('Error while saving the file!'));
            console.error(err);
          }
          else {
            console.log("Done!");
            console.log(chalk.white(''));// Reset to white
            process.exit(0);
          }
      });

    }
  });

}
