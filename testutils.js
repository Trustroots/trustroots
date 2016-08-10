
var path = require('path'),
    config = require(path.resolve('./config/config')),
    agenda = require(path.resolve('./config/lib/agenda'));

exports.catchJobs = function() {

  var jobs = [],
      originalNow;

  beforeEach(function() {

    jobs.length = 0;

    // Make agenda.now() give us it's jobs
    originalNow = agenda.now;
    agenda.now = function(type, data, callback) {

      // ensure it is plain data by serializing to json and back
      jobs.push(JSON.parse(JSON.stringify({ type: type, data: data })));

      // run in nextTick() to simulate async action that real agenda would do
      process.nextTick(function() {
        callback();
      });

    };

  });

  afterEach(function() {

    // Revert all changes we made
    agenda.now = originalNow;

  });

  return jobs;
};

exports.catchEmails = function() {

  var sentEmails = [],
      originalMailerOptions;

  beforeEach(function() {
    sentEmails.length = 0;

    // Make nodemailer give us it's emails
    originalMailerOptions = config.mailer.options;
    config.mailer.options = {
      name: 'testsend',
      version: '1',
      send: function(data, callback) {
        sentEmails.push(data);
        callback();
      },
      logger: false
    };

  });

  afterEach(function() {

    // Revert all changes we made
    config.mailer.options = originalMailerOptions;

  });

  return sentEmails;

};
